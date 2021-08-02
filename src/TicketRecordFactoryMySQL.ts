import {TicketRecordCreateInfo, TicketRecordFactory, TicketRecordFactoryInstallInfo} from '@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/EXT-Ticket/TicketRecordFactory';
import { Connection } from 'mysql2';
import { BackendAPPSystemSetting } from '@interactiveplus/pdk2021-backendcore/dist/AbstractDataTypes/SystemSetting/BackendAPPSystemSetting';
import { PDKInnerArgumentError, PDKItemNotFoundError, PDKUnknownInnerError } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Error/PDKException';
import { TicketRecordEntity, TicketRecordEntityID, TicketRecordSingleResponse } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/EXT-Ticket/TicketRecordEntity';
import { MaskUID } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/MaskID/MaskIDEntity';
import { APPUID } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/RegisteredAPP/APPEntityFormat';
import { UserEntityUID } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/User/UserEntity';
import { SearchResult } from '@interactiveplus/pdk2021-common/dist/InternalDataTypes/SearchResult';
import { generateRandomHexString } from '@interactiveplus/pdk2021-common/dist/Utilities/HEXString';
import { fetchMySQL, fetchMySQLCount } from './Utils/MySQLFetchUtil';
import { getMySQLTypeForAPPEntityUID, getMySQLTypeForMaskIDUID, getMySQLTypeForOAuthToken, getMySQLTypeForTicketID, getMySQLTypeForUserAccessToken, getMySQLTypeForUserUID } from './Utils/MySQLTypeUtil';

class TicketRecordFactoryMySQL implements TicketRecordFactory{

    constructor(public mysqlConnection : Connection, protected backendAPPSystemSetting : BackendAPPSystemSetting, public ticketIDLen : number){

    }


    isTicketIDNumber(): boolean {
        return false;
    }
    getTicketIDMaxLen(): number {
        return this.getTicketIDExactLen();
    }
    getTicketIDExactLen() : number{
        return this.ticketIDLen;
    }
    getTitleMaxLen() : number{
        return this.backendAPPSystemSetting.ticketRecordEntityFormat.titleMaxLen !== undefined ? this.backendAPPSystemSetting.ticketRecordEntityFormat.titleMaxLen : 50;
    }
    getContentMaxLen() : number{
        return this.backendAPPSystemSetting.ticketRecordEntityFormat.contentMaxLen !== undefined ? this.backendAPPSystemSetting.ticketRecordEntityFormat.contentMaxLen : 300;
    }
    getContentOriginatorAltNameMaxLen() : number{
        return this.backendAPPSystemSetting.ticketRecordEntityFormat.contentOriginatorAltNameMaxLen ? this.backendAPPSystemSetting.ticketRecordEntityFormat.contentOriginatorAltNameMaxLen : 20;
    }

    static parseTicketRecordEntityFromDBRow(dbRow : any, contentListing : TicketRecordSingleResponse[]) : TicketRecordEntity{
        if(
            !('ticket_id' in dbRow)
            || !('title' in dbRow)
            || !('user_uid' in dbRow)
        ){
            throw new PDKInnerArgumentError(['dbRow'],'Unexpected data type received when trying to parse TicketRecordEntity from database');
        }
        return {
            ticketId: dbRow.ticketId,
            title: dbRow.title,
            relatedMaskUID: dbRow.mask_uid !== null && dbRow.mask_uid !== undefined ? dbRow.mask_uid : null,
            relatedUID: dbRow.user_uid,
            relatedClientID: dbRow.client_id !== null && dbRow.client_id !== undefined ? dbRow.client_id : null,
            relatedAPPUID: dbRow.app_uid !== null && dbRow.app_uid !== undefined ? dbRow.app_uid : null,
            relatedOAuthToken: dbRow.oauth_token !== null && dbRow.oauth_token !== undefined ? dbRow.oauth_token : undefined,
            relatedUserToken: dbRow.user_token !== null && dbRow.user_token !== undefined ? dbRow.user_token : undefined,
            contents: contentListing
        };
    }

    static parseTicketRecordSingleResponseFromDBRow(dbRow : any) : TicketRecordSingleResponse{
        if(
            !('content' in dbRow)
            || !('content_by_user' in dbRow)
            || !('create_time' in dbRow)
            || !('modify_time' in dbRow)
        ){
            throw new PDKInnerArgumentError(['dbRow'],'Unexpected data type received while trying to parse ticket response from database in TicketRecord System');
        }
        return {
            content: dbRow.content,
            contentByUser: dbRow.content_by_user === 1,
            originatorAltName: dbRow.originator_alt_name !== undefined && dbRow.originator_alt_name !== null ? dbRow.originator_alt_name : undefined,
            contentCreateSecGMT: dbRow.create_time,
            contentModifySecGMT: dbRow.modify_time
        };
    }

    getAPPSystemSetting(): BackendAPPSystemSetting {
        return this.backendAPPSystemSetting;
    }

    async reRollNewTicketId(maxCallStack? : number) : Promise<string>{
        let rerolledID = generateRandomHexString(this.getTicketIDExactLen());
        let loopTime = 0;
        while(maxCallStack === undefined || loopTime < maxCallStack){
            if(!this.checkTicketRecordExists(rerolledID)){
                return rerolledID;
            }else{
                rerolledID = generateRandomHexString(this.getTicketIDExactLen());
            }
            loopTime++;
        }
        throw new PDKUnknownInnerError('Rerolled ' + loopTime.toString() + ' times of ticketId but all of them exists in the database');
    }

    async createTicketRecord(createInfo: TicketRecordCreateInfo): Promise<TicketRecordEntity> {
        let rolledTicketId = await this.reRollNewTicketId(10);
        let createTicketInfoStatement = 
        `INSERT INTO ticket_records
        (
            ticket_id,
            title,
            mask_uid,
            user_uid,
            client_id,
            app_uid,
            oauth_token,
            user_token
        ) VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
        )`;
        let createTicketInfoParams = [
            rolledTicketId,
            createInfo.title,
            createInfo.relatedMaskUID,
            createInfo.relatedUID,
            createInfo.relatedClientID,
            createInfo.relatedAPPUID,
            createInfo.relatedOAuthToken,
            createInfo.relatedUserToken
        ];
        await fetchMySQL(this.mysqlConnection,createTicketInfoStatement,createTicketInfoParams,true);

        if(createInfo.contents.length === 0){
            return Object.assign({
                ticketId: rolledTicketId
            },createInfo);
        }

        await this.appendTicketContents(rolledTicketId,createInfo.contents);
        
        return Object.assign({
            ticketId: rolledTicketId
        },createInfo);
    }

    async appendTicketContents(ticketId : TicketRecordEntityID, contents : TicketRecordSingleResponse[]) : Promise<void>{
        let createTicketContentStatement = 
        `INSERT INTO ticket_contents
        (
            ticket_id,
            content,
            content_by_user,
            originator_alt_name,
            create_time,
            modify_time
        ) VALUES `;

        let allContentValueStatement : string[] = [];
        let allContentValueParams : any[] = [];

        contents.forEach((value) => {
            allContentValueStatement.push(
                '(?,?,?,?,?,?)'
            );
            allContentValueParams.push(
                ticketId,
                value.content,
                value.contentByUser ? 1 : 0,
                value.originatorAltName,
                value.contentCreateSecGMT,
                value.contentModifySecGMT
            );
        });
        createTicketContentStatement += allContentValueStatement.join(', ');
        createTicketContentStatement += ';';
        await fetchMySQL(this.mysqlConnection,createTicketContentStatement,allContentValueParams,false);
    }

    async getTicketRecord(ticketRecordId: TicketRecordEntityID): Promise<TicketRecordEntity | undefined> {
        let selectStatement = 'SELECT FROM ticket_records WHERE ticket_id = ? LIMIT 1';
        let fetchResponse = await fetchMySQL(this.mysqlConnection,selectStatement,[ticketRecordId],true);
        if(!('length' in fetchResponse.result)){
            throw new PDKUnknownInnerError('Unexpected data type received when fetching data from TicketRecord System');
        }
        if(fetchResponse.result.length === 0){
            return undefined;
        }

        let allContents = await this.fetchTicketContents(ticketRecordId);
        
        let returnEntity : TicketRecordEntity = TicketRecordFactoryMySQL.parseTicketRecordEntityFromDBRow(fetchResponse.result[0],allContents);
        return returnEntity;
    }

    async fetchTicketContents(ticketId: TicketRecordEntityID) : Promise<TicketRecordSingleResponse[]>{
        //fetch all related contents from db
        let selectContentStatement = 'SELECT * FROM ticket_contents WHERE ticket_id = ? ORDER BY create_time ASC';
        let fetchContentResponse = await fetchMySQL(this.mysqlConnection,selectContentStatement,[ticketId],true);
        if(!('length' in fetchContentResponse.result)){
            throw new PDKUnknownInnerError('Unexpected data type received when fetching data from TicketRecord System');
        }
        let allContents : TicketRecordSingleResponse[] = [];
        fetchContentResponse.result.forEach((value) => {
            allContents.push(TicketRecordFactoryMySQL.parseTicketRecordSingleResponseFromDBRow(value));
        });
        return allContents;
    }

    async updateTicketRecordBasicInfo(ticketId: TicketRecordEntityID, newEntity: TicketRecordEntity, oldEntity?: TicketRecordEntity): Promise<void> {
        let updateStatement = 
        `UPDATE ticket_records SET 
            title = ?,
            mask_uid = ?,
            user_uid = ?,
            client_id = ?,
            app_uid = ?,
            oauth_token = ?,
            user_token = ?
        WHERE ticket_id = ?;`;
        let fetchResult = await fetchMySQL(
            this.mysqlConnection, 
            updateStatement, 
            [
                newEntity.title,
                newEntity.relatedMaskUID,
                newEntity.relatedUID,
                newEntity.relatedClientID,
                newEntity.relatedAPPUID,
                newEntity.relatedOAuthToken,
                newEntity.relatedUserToken,
                ticketId
            ],
            true
        );
        if(!('affectedRows' in fetchResult.result)){
            throw new PDKUnknownInnerError('Unexpected data type received when updating data in TicketRecord System');
        }
        if(fetchResult.result.affectedRows <= 0){
            throw new PDKItemNotFoundError(['ticket_id']);
        }
        return;
    }
    async updateTicketRecordResponseList(ticketId: TicketRecordEntityID, newResponse: TicketRecordSingleResponse[], oldResponse?: TicketRecordSingleResponse[]): Promise<void> {
        if(oldResponse === undefined){
            oldResponse = await this.fetchTicketContents(ticketId);
        }
        //delete ALL responses FIRST
        let deleteStatement = 'DELETE FROM ticket_contents WHERE ticket_id = ?;';
        await fetchMySQL(this.mysqlConnection,deleteStatement,[ticketId],true);
        await this.appendTicketContents(ticketId,newResponse);
    }

    async deleteTicketRecord(ticketId: TicketRecordEntityID): Promise<void> {
        let deleteInfoStatement = 'DELETE FROM ticket_records WHERE ticket_id = ?';
        let deleteContentsStatement = 'DELETE FROM ticket_contents WHERE ticket_id = ?';
        await fetchMySQL(this.mysqlConnection,deleteInfoStatement,[ticketId],true);
        await fetchMySQL(this.mysqlConnection,deleteContentsStatement,[ticketId],true);
    }
    async checkTicketRecordExists(ticketId: TicketRecordEntityID): Promise<boolean> {
        return (await fetchMySQLCount(
            this.mysqlConnection,
            'ticket_records',
            'ticket_id = ?',
            [ticketId],
            true
        )) >= 1;
    }

    getSearchWhereClausesAndParams(ticketId?: TicketRecordEntityID, title?: string, content?: string, originatorAltName?: string, relatedMaskUID?: MaskUID | null, relatedUID?: UserEntityUID, relatedClientID?: string | null, relatedAPPUID?: APPUID | null, relatedOAuthToken?: string, relatedUserToken?: string) : {clauses: string[], params : any[]}{
        let allWhereClauses : string[] = [];
        let allWhereParams : any[] = [];
        if(ticketId !== undefined){
            allWhereClauses.push('ticket_records.ticket_id = ?');
            allWhereParams.push(ticketId);
        }
        if(title !== undefined){
            allWhereClauses.push('ticket_records.title LIKE ?');
            allWhereParams.push('%' + title + '%');
        }
        if(relatedMaskUID !== undefined){
            allWhereClauses.push('ticket_records.mask_uid = ?');
            allWhereParams.push(relatedMaskUID);
        }
        if(relatedUID !== undefined){
            allWhereClauses.push('ticket_records.user_uid = ?');
            allWhereParams.push(relatedUID);
        }
        if(relatedClientID !== undefined){
            allWhereClauses.push('ticket_records.client_id = ?');
            allWhereParams.push(relatedClientID);
        }
        if(relatedAPPUID !== undefined){
            allWhereClauses.push('ticket_records.app_uid = ?');
            allWhereParams.push(relatedAPPUID);
        }
        if(relatedOAuthToken !== undefined){
            allWhereClauses.push('ticket_records.oauth_token = ?');
            allWhereParams.push(relatedOAuthToken);
        }
        if(relatedUserToken !== undefined){
            allWhereClauses.push('ticket_records.user_token = ?');
            allWhereParams.push(relatedUserToken);
        }
        if(content !== undefined || originatorAltName !== undefined){
            let subStatement = 'SELECT ticket_id FROM ticket_contents WHERE ';
            let subWhereClauses : string[] = [];
            let subWhereParams : any[] = [];
            subWhereClauses.push('ticket_records.ticket_id = ticket_contents.ticket_id');
            if(content !== undefined){
                subWhereClauses.push('ticket_contents.content LIKE ?');
                subWhereParams.push('%' + content + '%');
            }
            if(originatorAltName !== undefined){
                subWhereClauses.push('ticket_contents.originator_alt_name LIKE ?');
                subWhereParams.push('%' + originatorAltName + '%');
            }
            subStatement += subWhereClauses.join(' AND ');
            
            allWhereClauses.push('EXISTS (' + subStatement + ')');
            allWhereParams.push(...subWhereParams);
        }
        return {
            clauses: allWhereClauses,
            params: allWhereParams
        };
    }

    async getTicketRecordCount(ticketId?: TicketRecordEntityID, title?: string, content?: string, originatorAltName?: string, relatedMaskUID?: MaskUID | null, relatedUID?: UserEntityUID, relatedClientID?: string | null, relatedAPPUID?: APPUID | null, relatedOAuthToken?: string, relatedUserToken?: string): Promise<number> {
        let searchInfo = this.getSearchWhereClausesAndParams(ticketId,title,content,originatorAltName,relatedMaskUID,relatedUID,relatedClientID,relatedAPPUID,relatedOAuthToken,relatedUserToken);
        let whereClause = searchInfo.clauses.join(' AND ');

        return await fetchMySQLCount(this.mysqlConnection,'ticket_records',whereClause === '' ? undefined : whereClause,searchInfo.params,true);
    }
    async searchTicketRecord(ticketId?: TicketRecordEntityID, title?: string, content?: string, originatorAltName?: string, relatedMaskUID?: MaskUID | null, relatedUID?: UserEntityUID, relatedClientID?: string | null, relatedAPPUID?: APPUID | null, relatedOAuthToken?: string, relatedUserToken?: string, numLimit?: number, startPosition?: number): Promise<SearchResult<TicketRecordEntity>> {
        let searchInfo = this.getSearchWhereClausesAndParams(ticketId,title,content,originatorAltName,relatedMaskUID,relatedUID,relatedClientID,relatedAPPUID,relatedOAuthToken,relatedUserToken);
        let whereClause = searchInfo.clauses.join(' AND ');

        let selectStatement = 'SELECT * FROM ticket_records' + (whereClause !== '' ? ' WHERE ' + whereClause : '');
        if(numLimit !== undefined){
            selectStatement += ' LIMIT ' + numLimit.toString();
        }
        if(startPosition !== undefined){
            selectStatement += ' OFFSET ' + startPosition.toString();
        }
        selectStatement += ';';
        let selectResult = await fetchMySQL(this.mysqlConnection,selectStatement,searchInfo.params,true);
        if(!('length' in selectResult.result)){
            throw new PDKUnknownInnerError('Unexpected data type received when fetching data from TicketRecord System');
        }
        let allFetchedEntities : TicketRecordEntity[] = [];
        for(let i=0; i<selectResult.result.length; i++){
            let currentRow = selectResult.result[i];
            if(!('ticket_id' in currentRow)){
                throw new PDKUnknownInnerError('Unexpected data type received when fetching data from TicketRecord System');
            }
            let fetchedContentListing = await this.fetchTicketContents(currentRow.ticket_id);
            let fetchedEntity = TicketRecordFactoryMySQL.parseTicketRecordEntityFromDBRow(currentRow,fetchedContentListing);
            allFetchedEntities.push(fetchedEntity);
        }
        return new SearchResult<TicketRecordEntity>(allFetchedEntities.length,allFetchedEntities);
    }
    async clearTicketRecord(ticketId?: TicketRecordEntityID, title?: string, content?: string, originatorAltName?: string, relatedMaskUID?: MaskUID | null, relatedUID?: UserEntityUID, relatedClientID?: string | null, relatedAPPUID?: APPUID | null, relatedOAuthToken?: string, relatedUserToken?: string, numLimit?: number, startPosition?: number): Promise<void> {
        let searchInfo = this.getSearchWhereClausesAndParams(ticketId,title,content,originatorAltName,relatedMaskUID,relatedUID,relatedClientID,relatedAPPUID,relatedOAuthToken,relatedUserToken);
        let whereClause = searchInfo.clauses.join(' AND ');
        let delStatement = 'DELETE FROM ticket_records' + (whereClause !== '' ? ' WHERE ' + whereClause : '');
        if(numLimit !== undefined){
            delStatement += ' LIMIT ' + numLimit.toString();
        }
        if(startPosition !== undefined){
            delStatement += ' OFFSET ' + startPosition.toString();
        }
        delStatement += ';';
        await fetchMySQL(this.mysqlConnection,delStatement,searchInfo.params,true);
        await this.clearUnrelatedTicketContents();
    }
    async clearUnrelatedTicketContents() : Promise<number>{
        let delStatement = 
        `DELETE FROM ticket_contents WHERE NOT EXISTS (
            SELECT ticket_id FROM ticket_records WHERE ticket_records.ticket_id = ticket_contents.ticket_id    
        )`;
        let result = await fetchMySQL(this.mysqlConnection,delStatement,undefined,true);
        if(!('affectedRows' in result.result)){
            throw new PDKUnknownInnerError('Unexpected data type received when clearing data from TicketRecord System');
        }
        return result.result.affectedRows;
    }
    async install(params: TicketRecordFactoryInstallInfo): Promise<void> {
        let createInfoTableStatement = 
        `CREATE TABLE ticket_records
        (
            ticket_id ${getMySQLTypeForTicketID(this)} NOT NULL,
            title VARCHAR(${this.getTitleMaxLen().toString()}) NOT NULL,
            mask_uid ${getMySQLTypeForMaskIDUID(params.maskIDEntityFactory)},
            user_uid ${getMySQLTypeForUserUID(params.userEntityFactory)} NOT NULL,
            client_id ${getMySQLTypeForAPPEntityUID(params.appEntityFactory)},
            app_uid ${getMySQLTypeForAPPEntityUID(params.appEntityFactory)},
            oauth_token ${getMySQLTypeForOAuthToken(params.oAuthTokenFactory)},
            user_token ${getMySQLTypeForUserAccessToken(params.userTokenFactory)}
        );`;
        let createContentTableStatement =
        `CREATE TABLE ticket_contents
        (
            ticket_id ${getMySQLTypeForTicketID(this)} NOT NULL,
            content VARCHAR(${this.getContentMaxLen().toString()}) NOT NULL,
            content_by_user TINYINT(1) NOT NULL,
            originator_alt_name VARCHAR(${this.getContentOriginatorAltNameMaxLen().toString()}),
            create_time INT UNSIGNED NOT NULL,
            modify_time INT UNSIGNED NOT NULL
        );`;
        await fetchMySQL(this.mysqlConnection,createInfoTableStatement,undefined,false);
        await fetchMySQL(this.mysqlConnection,createContentTableStatement,undefined,false);
        return;
    }
    async uninstall(): Promise<void> {
        let dropInfoTableStatement = 'DROP TABLE ticket_records';
        let dropContentTableStatement = 'DROP TABLE ticket_contents';
        await fetchMySQL(this.mysqlConnection,dropInfoTableStatement,undefined,false);
        await fetchMySQL(this.mysqlConnection,dropContentTableStatement,undefined,false);
    }
    async clearData(): Promise<void> {
        let clearInfoTableStatement = 'TRUNCATE TABLE ticket_records';
        let clearContentTableStatement = 'TRUNCATE TABLE ticket_contents';
        await fetchMySQL(this.mysqlConnection,clearInfoTableStatement,undefined,false);
        await fetchMySQL(this.mysqlConnection,clearContentTableStatement,undefined,false);
    }
}

export {TicketRecordFactoryMySQL};