import {TicketRecordCreateInfo, TicketRecordFactory, TicketRecordFactoryInstallInfo} from '@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/EXT-Ticket/TicketRecordFactory';
import { Connection } from 'mysql2';
import { BackendAPPSystemSetting } from '../../PDK2021-BackendCore/dist/AbstractDataTypes/SystemSetting/BackendAPPSystemSetting';
import { TicketRecordEntity, TicketRecordEntityID, TicketRecordSingleResponse } from '../../pdk2021-common/dist/AbstractDataTypes/EXT-Ticket/TicketRecordEntity';
import { MaskUID } from '../../pdk2021-common/dist/AbstractDataTypes/MaskID/MaskIDEntity';
import { APPUID } from '../../pdk2021-common/dist/AbstractDataTypes/RegisteredAPP/APPEntityFormat';
import { UserEntityUID } from '../../pdk2021-common/dist/AbstractDataTypes/User/UserEntity';
import { SearchResult } from '../../pdk2021-common/dist/InternalDataTypes/SearchResult';
import { fetchMySQL } from './Utils/MySQLFetchUtil';
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
    getAPPSystemSetting(): BackendAPPSystemSetting {
        throw new Error('Method not implemented.');
    }
    createTicketRecord(createInfo: TicketRecordCreateInfo): Promise<TicketRecordEntity> {
        throw new Error('Method not implemented.');
    }
    getTicketRecord(ticketRecordId: TicketRecordEntityID): Promise<TicketRecordEntity | undefined> {
        throw new Error('Method not implemented.');
    }
    updateTicketRecordBasicInfo(ticketId: TicketRecordEntityID, newEntity: TicketRecordEntity, oldEntity?: TicketRecordEntity): Promise<void> {
        throw new Error('Method not implemented.');
    }
    updateTicketRecordResponseList(ticketId: TicketRecordEntityID, newResponse: TicketRecordSingleResponse[], oldResponse?: TicketRecordSingleResponse[]): Promise<void> {
        throw new Error('Method not implemented.');
    }
    deleteTicketRecord(ticketId: TicketRecordEntityID): Promise<void> {
        throw new Error('Method not implemented.');
    }
    checkTicketRecordExists(ticketId: TicketRecordEntityID): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    getTicketRecordCount(ticketId?: TicketRecordEntityID, title?: string, content?: string, originatorAltName?: string, relatedMaskUID?: MaskUID | null, relatedUID?: UserEntityUID, relatedClientID?: string | null, relatedAPPUID?: APPUID | null, relatedOAuthToken?: string, relatedUserToken?: string): Promise<number> {
        throw new Error('Method not implemented.');
    }
    searchTicketRecord(ticketId?: TicketRecordEntityID, title?: string, content?: string, originatorAltName?: string, relatedMaskUID?: MaskUID | null, relatedUID?: UserEntityUID, relatedClientID?: string | null, relatedAPPUID?: APPUID | null, relatedOAuthToken?: string, relatedUserToken?: string, numLimit?: number, startPosition?: number): Promise<SearchResult<TicketRecordEntity>> {
        throw new Error('Method not implemented.');
    }
    clearTicketRecord(ticketId?: TicketRecordEntityID, title?: string, content?: string, originatorAltName?: string, relatedMaskUID?: MaskUID | null, relatedUID?: UserEntityUID, relatedClientID?: string | null, relatedAPPUID?: APPUID | null, relatedOAuthToken?: string, relatedUserToken?: string, numLimit?: number, startPosition?: number): Promise<void> {
        throw new Error('Method not implemented.');
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
            contentByUser TINYINT(1) NOT NULL,
            originatorAltName VARCHAR(${this.getContentOriginatorAltNameMaxLen().toString()})
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