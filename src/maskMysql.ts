import mysql, {Connection, RowDataPacket} from 'mysql2';
import {MaskIDEntityFactory, MaskIDCreateEntity} from "@interactiveplus/pdk2021-backendcore/dist/MaskID/MaskIDEntityFactory";
import {MaskIDEntity} from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/MaskID/MaskIDEntity";
import { PDKAbstractDataTypes, PDKInternalDataTypes } from 'pdk2021-common';

class maskMysql implements MaskIDEntityFactory{
    constructor (public mysqlConnection:Connection) {}

    createMaskIDEntity(createEntity: MaskIDCreateEntity): Promise<PDKAbstractDataTypes.MaskIDEntity>{
        return new Promise<MaskIDEntity>(
            (resolve, reject) =>{
                let createStatement = 
                `INSERT INTO maskIDs
                (relatedUID, maskUID, displayName, createTime, currentAuthorizedAPPUIDs, pastAuthorizedAPPUIDs, settings)
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
                this.mysqlConnection.execute(
                    createStatement,
                    [
                        createEntity.relatedUID,
                        createEntity.maskUID,
                        createEntity.displayName,
                        createEntity.createTime,
                        createEntity.currentAuthorizedAPPUIDs,
                        createEntity.pastAuthorizedAPPUIDs,
                        createEntity.settinggs
                    ],
                    function(err, result, fields){
                        if (err !== null){
                            reject(err);
                        } else {
                            let returnedMaskEntity:MaskIDEntity = {
                                relatedUID: createEntity.relatedUID,
                                maskUID: createEntity.maskUID,
                                displayName: createEntity.displayName,
                                createTime: createEntity.createTime,
                                currentAuthorizedAPPUIDs: createEntity.currentAuthorizedAPPUIDs,
                                pastAuthorizedAPPUIDs: createEntity.pastAuthorizedAPPUIDs,
                                settings: createEntity.settinggs
                            }
                            resolve(returnedMaskEntity)
                        }
                    }
                )
            }
        )
    }

    getMaskIDEntity(maskUID: PDKAbstractDataTypes.MaskUID): Promise<PDKAbstractDataTypes.MaskIDEntity | undefined>{
        return new Promise<MaskIDEntity |undefined>(
            (resolve, reject) => {
                let selectStatement = `SELECT * FROM maskIDs WHERE maskUID = ?`;
                this.mysqlConnection.execute(selectStatement, [maskUID], function(err, result, fields){
                    if (err !== null) {
                        reject(err);
                    } else {
                        if ("length" in result ){
                            if ( result.length === 0 ) {
                            resolve (undefined);
                            } else {
                                if ("relatedUID" in result[0] && 
                                    "maskUID" in result[0] && 
                                    "displayName" in result[0] &&
                                    "createTime" in result[0] &&
                                    "currentAuthorizedAPPUIDs" in result[0] &&
                                    "pastAuthorizedAPPUIDs" in result[0] &&
                                    "settings" in result[0]) 
                                { 
                                    let returnedMaskEntity : MaskIDEntity = {
                                    "relatedUID" : result[0].relatedUID, 
                                    "maskUID" : result[0].maskUID,
                                    "displayName" : result[0].displayName,
                                    "createTime": result[0].createTime,
                                    "currentAuthorizedAPPUIDs" : result[0].currentAuthorizedAPPUIDs,
                                    "pastAuthorizedAPPUIDs" : result[0].pastAuthorizedAPPUIDs,
                                    "settings" : result[0].settings
                                    }
                                    resolve(returnedMaskEntity)
                                } else {
                                    reject("missing fileds")
                                }
                            }
                        } else {
                            reject("unexpected error")
                        }
                    }
                })
            }
        )
    }
    
    updateMaskIDEntity(maskUID: PDKAbstractDataTypes.MaskUID, maskEntity: PDKAbstractDataTypes.MaskIDEntity, oldMaskEntity?: PDKAbstractDataTypes.MaskIDEntity): Promise<void>{
        return new Promise<void>(
            (resolve, reject) => {
                let updateStatement = 
                ` UPDATE maskIDs SET
                relatedID = ?, displayName = ?, createTime = ? currentAuthorizedAPPUIDs = ?, pastAuthorizedAPPUIDs = ?, settings = ?,
                WHERE maskUID = ?;`;
                this.mysqlConnection.execute(updateStatement, 
                    [
                        maskEntity.relatedID,
                        maskEntity.displayName,
                        maskEntity.createTime,
                        maskEntity.currentAuthorizedAPPUIDs,
                        maskEntity.pastAuthorizedAPPUIDs,
                        maskEntity.settings,
                        maskUID
                    ], 
                    (err, result, fields)=>{
                        if (err !== null){
                            reject(err);
                        } else {
                            if ("affectedRows" in result && result.affectedRows === 0 ) {
                                reject("no maskUID found")
                            } else {
                                resolve()
                            }
                        }
                    }
                )
            }
        )
    }


    deleteMaskIDEntity(maskUID: PDKAbstractDataTypes.MaskUID): Promise<void>{
        return new Promise<void>(
            (resolve, reject) => {
                let deleteStatement = `DELETE FROM maskIDs WHERE maskUID = ?;`;
                this.mysqlConnection.execute( deleteStatement, [maskUID], 
                    (err, result, fields) => {
                        if (err !== null) {
                            reject(err);
                        } else {
                            if ("affectedRows" in result && result.affectedRows === 0 ) {
                                reject("no maskUID found")
                            } else {
                                resolve()
                            }
                        }
                    }
                )
            }
        )
    }


    // getMaskIDEntityCount(maskUID?: PDKAbstractDataTypes.MaskUID, displayName?: string, userUID?: PDKAbstractDataTypes.UserEntityUID, appUID?: PDKAbstractDataTypes.APPUID, createTimeMin?: number, createTimeMax?: number): number;
    // searchMaskIDEntity(maskUID?: PDKAbstractDataTypes.MaskUID, displayName?: string, userUID?: PDKAbstractDataTypes.UserEntityUID, appUID?: PDKAbstractDataTypes.APPUID, createTimeMin?: number, createTimeMax?: number, numLimit?: number, startPosition?: number): PDKInternalDataTypes.SearchResult<PDKAbstractDataTypes.MaskIDEntity>;
    // clearMaskIDEntity(maskUID?: PDKAbstractDataTypes.MaskUID, displayName?: string, userUID?: PDKAbstractDataTypes.UserEntityUID, appUID?: PDKAbstractDataTypes.APPUID, createTimeMin?: number, createTimeMax?: number, numLimit?: number, startPosition?: number): void;

    createTable(){
        let createCommand = `CREATE TABLE maskIDs 
                            (
                                'relatedUID' VARCAHR(100),
                                'maskUID' VARCHAR(100),
                                'displayName' VARCHAR(40),
                                'createTime' INT UNSIGED,
                                'currentAuthorizedAPPUIDs' VARCHAR SET;
                                'pastAuthorizedAPPUIDs' VARCHAR SET;
                                'settings' JSON NOT NULL; 
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
        })
    }



}
