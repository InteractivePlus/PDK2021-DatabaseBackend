import {Connection} from 'mysql2';
import {MaskIDEntityFactory, MaskIDCreateEntity} from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/MaskID/MaskIDEntityFactory";
import {MaskIDEntity, MaskUID} from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/MaskID/MaskIDEntity";
import {generateRandomHexString} from "@interactiveplus/pdk2021-common/dist/Utilities/HEXString";
import { convertErorToPDKStorageEngineError } from './Utils/MySQLErrorUtil';
import { PDKInnerArgumentError, PDKItemNotFoundError, PDKUnknownInnerError } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Error/PDKException';
import { UserEntityUID } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/User/UserEntity';
import { SearchResult } from '@interactiveplus/pdk2021-common/dist/InternalDataTypes/SearchResult';
import { BackendOAuthSystemSetting }  from '@interactiveplus/pdk2021-backendcore/dist/AbstractDataTypes/SystemSetting/BackendOAuthSystemSetting';

class MaskFactoryMySQL implements MaskIDEntityFactory{
    constructor (
        public mysqlConnection:Connection, 
        public maskIDLength : number,
        protected oAuthSystemSetting: BackendOAuthSystemSetting
    ) {}

    public static parseMaskIDEntityFromDB(dbObject : any) : MaskIDEntity{
        if ("relatedUID" in dbObject && 
            "maskUID" in dbObject && 
            "displayName" in dbObject &&
            "createTime" in dbObject &&
            "settings" in dbObject) 
        { 
            let returnedMaskEntity : MaskIDEntity = {
                relatedUID : dbObject.relatedUID, 
                maskUID : dbObject.maskUID,
                displayName : dbObject.displayName,
                createTime: dbObject.createTime,
                settings : dbObject.settings
            }
            return returnedMaskEntity;
        }else{
            throw new PDKInnerArgumentError<'dbObject'>(['dbObject'], 'Unexpected Incomplete MaskIDEntity received from DB');
        }
    }

    getMaskIDMaxLength(): number{
        return this.maskIDLength;
    }
    getMaskExactLength(): number{
        return this.maskIDLength;
    }

    getOAuthSystemSetting() : BackendOAuthSystemSetting{
        return this.oAuthSystemSetting;
    }

    createMaskIDEntity(createEntity: MaskIDCreateEntity): Promise<MaskIDEntity>{
        return new Promise<MaskIDEntity>(
            (resolve, reject) =>{
                let generatedMaskUID = generateRandomHexString(40);
                let createStatement = 
                `INSERT INTO mask_ids
                (relatedUID, maskUID, displayName, createTime, settings)
                VALUES (?, ?, ?, ?, ?)`;
                this.mysqlConnection.execute(
                    createStatement,
                    [
                        createEntity.relatedUID,
                        generatedMaskUID,
                        createEntity.displayName,
                        createEntity.createTime,
                        createEntity.settings
                    ],
                    function(err, result, fields){
                        if (err !== null){
                            reject(convertErorToPDKStorageEngineError(err));
                        } else {
                            let returnedMaskEntity:MaskIDEntity = {
                                relatedUID: createEntity.relatedUID,
                                maskUID: generatedMaskUID,
                                displayName: createEntity.displayName,
                                createTime: createEntity.createTime,
                                settings: createEntity.settings
                            }
                            resolve(returnedMaskEntity)
                        }
                    }
                )
            }
        )
    }

    getMaskIDEntity(maskUID: MaskUID): Promise<MaskIDEntity | undefined>{
        return new Promise<MaskIDEntity |undefined>(
            (resolve, reject) => {
                let selectStatement = `SELECT * FROM mask_ids WHERE maskUID = ?`;
                this.mysqlConnection.execute(selectStatement, [maskUID], function(err, result, fields){
                    if (err !== null) {
                        reject(err);
                    } else {
                        if ("length" in result ){
                            if ( result.length === 0 ) {
                            resolve (undefined);
                            } else {
                                resolve(MaskFactoryMySQL.parseMaskIDEntityFromDB(result[0]));
                            }
                        } else {
                            reject(new PDKUnknownInnerError("Unexpected datatype received when fetching MYSQL data from MASKID System"))
                        }
                    }
                })
            }
        )
    }
    
    updateMaskIDEntity(maskUID: MaskUID, maskEntity: MaskIDEntity, oldMaskEntity?: MaskIDEntity): Promise<void>{
        return new Promise<void>(
            (resolve, reject) => {
                let updateStatement = 
                ` UPDATE mask_ids SET
                relatedUID = ?, displayName = ?, createTime = ? settings = ?,
                WHERE maskUID = ?;`;
                this.mysqlConnection.execute(updateStatement, 
                    [
                        maskEntity.relatedUID,
                        maskEntity.displayName,
                        maskEntity.createTime,
                        maskEntity.settings,
                        maskUID
                    ], 
                    (err, result, fields)=>{
                        if (err !== null){
                            reject(convertErorToPDKStorageEngineError(err));
                        } else {
                            if ("affectedRows" in result && result.affectedRows === 0 ) {
                                reject(new PDKItemNotFoundError<'maskUID'>(['maskUID']));
                            } else {
                                resolve()
                            }
                        }
                    }
                )
            }
        )
    }

    deleteMaskIDEntity(maskUID: MaskUID): Promise<void>{
        return new Promise<void>(
            (resolve, reject) => {
                let deleteStatement = `DELETE FROM mask_ids WHERE maskUID = ?;`;
                this.mysqlConnection.execute( deleteStatement, [maskUID], 
                    (err, result, fields) => {
                        if (err !== null) {
                            reject(err);
                        } else {
                            if ("affectedRows" in result && result.affectedRows === 0 ) {
                                reject(new PDKItemNotFoundError<'maskUID'>(['maskUID']));
                            } else {
                                resolve();
                            }
                        }
                    }
                )
            }
        )
    }

    getMaskIDEntityCount(
        maskUID?: MaskUID, 
        displayName?: string, 
        userUID?: UserEntityUID,  
        createTimeMin?: number, 
        createTimeMax?: number
    ): Promise<number>{
        return new Promise<number>(
            (resolve, reject) => {
                let selectStatement = `SELECT count(*) as count FROM mask_ids`;
                let allParams : any[] = [];
                let allWHERESubClause : string[] = [];
                if(maskUID !== undefined){
                    allWHERESubClause.push('maskUID = ?');
                    allParams.push(maskUID);
                }
                if(displayName !== undefined){
                    allWHERESubClause.push('displayName LIKE ?');
                    allParams.push('%' + displayName + '%');
                }
                if(userUID !== undefined){
                    allWHERESubClause.push('relatedUID = ?');
                    allParams.push(userUID);
                }
                if(createTimeMin !== undefined){
                    allWHERESubClause.push('createTime >= ?');
                    allParams.push(createTimeMin);
                }
                if(createTimeMax !== undefined){
                    allWHERESubClause.push('createTime <= ?');
                    allParams.push(createTimeMax);
                }
                selectStatement += allWHERESubClause.length > 1 ? ' WHERE ' + allWHERESubClause.join(' AND ') : '';

                this.mysqlConnection.execute(selectStatement, allParams, 
                    (err, result, fields) => {
                        if (err !== null) {
                            reject(convertErorToPDKStorageEngineError(err));
                        } else {
                            if('length' in result && result.length !== 0 && 'count' in result[0]){
                                resolve(
                                    result[0].count
                                )
                            }
                        }
                    }
                );
            }
        );
    }
    
    searchMaskIDEntity(maskUID?: MaskUID, displayName?: string, userUID?: UserEntityUID, createTimeMin?: number, createTimeMax?: number, numLimit?: number, startPosition?: number): Promise<SearchResult<MaskIDEntity>>{
        return new Promise<SearchResult<MaskIDEntity>>(
            (resolve, reject) => {
                let selectStatement = `SELECT * FROM mask_ids`;
                let allParams : any[] = [];
                let allWHERESubClause : string[] = [];
                if(maskUID !== undefined){
                    allWHERESubClause.push('maskUID = ?');
                    allParams.push(maskUID);
                }
                if(displayName !== undefined){
                    allWHERESubClause.push('displayName LIKE ?');
                    allParams.push('%' + displayName + '%');
                }
                if(userUID !== undefined){
                    allWHERESubClause.push('relatedUID = ?');
                    allParams.push(userUID);
                }
                if(createTimeMin !== undefined){
                    allWHERESubClause.push('createTime >= ?');
                    allParams.push(createTimeMin);
                }
                if(createTimeMax !== undefined){
                    allWHERESubClause.push('createTime <= ?');
                    allParams.push(createTimeMax);
                }
                selectStatement += allWHERESubClause.length > 1 ? ' WHERE ' + allWHERESubClause.join(' AND ') : '';
                if(numLimit !== undefined){
                    selectStatement += ' LIMIT ' + numLimit;
                }
                if(startPosition !== undefined){
                    selectStatement += ' OFFSET ' + startPosition;
                }

                this.mysqlConnection.execute(selectStatement, allParams, 
                    (err, result, fields) => {
                        if (err !== null) {
                            reject(convertErorToPDKStorageEngineError(err));
                        } else {
                            if('length' in result && result.length !== 0 && 'count' in result[0]){
                                let parsedEntities : MaskIDEntity[] = [];
                                result.forEach((value) => {
                                    parsedEntities.push(MaskFactoryMySQL.parseMaskIDEntityFromDB(value));
                                });
                                resolve(new SearchResult<MaskIDEntity>(
                                    parsedEntities.length,
                                    parsedEntities
                                ));
                            }
                        }
                    }
                );
            }
        )
    }
    
    clearMaskIDEntity(maskUID?: MaskUID, displayName?: string, userUID?: UserEntityUID, createTimeMin?: number, createTimeMax?: number, numLimit?: number, startPosition?: number): Promise<void>{
        return new Promise<void>(
            (resolve, reject) => {
                let selectStatement = `DELETE FROM mask_ids`;
                let allParams : any[] = [];
                let allWHERESubClause : string[] = [];
                if(maskUID !== undefined){
                    allWHERESubClause.push('maskUID = ?');
                    allParams.push(maskUID);
                }
                if(displayName !== undefined){
                    allWHERESubClause.push('displayName LIKE ?');
                    allParams.push('%' + displayName + '%');
                }
                if(userUID !== undefined){
                    allWHERESubClause.push('relatedUID = ?');
                    allParams.push(userUID);
                }
                if(createTimeMin !== undefined){
                    allWHERESubClause.push('createTime >= ?');
                    allParams.push(createTimeMin);
                }
                if(createTimeMax !== undefined){
                    allWHERESubClause.push('createTime <= ?');
                    allParams.push(createTimeMax);
                }
                selectStatement += allWHERESubClause.length > 1 ? ' WHERE ' + allWHERESubClause.join(' AND ') : '';
                if(numLimit !== undefined){
                    selectStatement += ' LIMIT ' + numLimit;
                }
                if(startPosition !== undefined){
                    selectStatement += ' OFFSET ' + startPosition;
                }

                this.mysqlConnection.execute(selectStatement, allParams, 
                    (err, result, fields) => {
                        if (err !== null) {
                            reject(convertErorToPDKStorageEngineError(err));
                        } else {
                            resolve();
                        }
                    }
                );
            }
        );
    }

    getNicknameMaxLen() : number{
        let nicknameMaxLen = 0;
        if(this.oAuthSystemSetting.maskIDEntityFormat.nicknameMaxLen !== undefined){
            nicknameMaxLen = this.oAuthSystemSetting.maskIDEntityFormat.nicknameMaxLen;
        }else{
            nicknameMaxLen = 100;
        }
        return nicknameMaxLen;
    }

    install() : Promise<void>{
        let createCommand = `CREATE TABLE mask_ids 
                            (
                                'relatedUID' VARCAHR(100),
                                'maskUID' CHAR(${this.maskIDLength}),
                                'displayName' VARCHAR(${this.getNicknameMaxLen()}),
                                'createTime' INT UNSIGED,
                                'settings' JSON NOT NULL,
                                PRIMARY KEY (maskUID)
                            );`;
        return new Promise((resolve, reject) =>{
            this.mysqlConnection.query(
                createCommand,
                function(err, result, fields) {
                    if (err !== null){
                        reject(err);
                    } else {
                        resolve (undefined);
                    }
                }
            )
        });
    }

    uninstall(): Promise<void>{
        let createCommand = `DROP TABLE mask_ids`;
        return new Promise((resolve, reject) =>{
            this.mysqlConnection.query(
                createCommand,
                function(err, result, fields) {
                    if (err !== null){
                        reject(err);
                    } else {
                        resolve (undefined);
                    }
                }
            )
        })
    }

    clearData(): Promise<void>{
        let createCommand = `TRUNCATE TABLE mask_ids `;
        return new Promise((resolve, reject) =>{
            this.mysqlConnection.query(
                createCommand,
                function(err, result, fields) {
                    if (err !== null){
                        reject(err);
                    } else {
                        resolve (undefined);
                    }
                }
            )
        })
    }
}

export {MaskFactoryMySQL};