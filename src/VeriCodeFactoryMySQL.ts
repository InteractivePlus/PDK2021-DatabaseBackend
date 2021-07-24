import {Connection} from 'mysql2';
import {VerificationCodeEntityFactory, VerificationCodeCreateEntity, VerificationCodeEntityFactoryInstallInfo} from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/Communication/VerificationCode/VerificationCodeEntityFactory";
import {VerificationCodeEntity} from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Communication/VerificationCode/VerificationCodeEntity"
import { BackendCommunicationSystemSetting } from '@interactiveplus/pdk2021-backendcore/dist/AbstractDataTypes/SystemSetting/BackendCommunicationSystemSetting';
import { CommunicationSystemSetting } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/SystemSetting/CommunicationSystemSetting';
import { getMySQLTypeForAPPClientID, getMySQLTypeForAPPEntityUID, getMySQLTypeForMaskIDUID, getMySQLTypeForOAuthToken, getMySQLTypeForUserUID } from './Utils/MySQLTypeUtil';
import { convertErorToPDKStorageEngineError } from './Utils/MySQLErrorUtil';
import {generateRandomHexString} from "@interactiveplus/pdk2021-common/dist/Utilities/HEXString";
import {  PDKItemNotFoundError, PDKRequestParamFormatError, PDKUnknownInnerError } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Error/PDKException';
interface VericodeFactoryMySQLVerifyInfo{
    code: string,
    isShortCode: boolean
}

export type {VericodeFactoryMySQLVerifyInfo};

class VericodeFactoryMySQL implements VerificationCodeEntityFactory<VericodeFactoryMySQLVerifyInfo>{
    constructor(public mysqlConnection:Connection, protected communicationSystemSetting : BackendCommunicationSystemSetting, public useScopeMaxLen: number) {}
    
    getVerificationCodeMaxLen(): number {
        throw this.getVerificationCodeExactLen();
    }

    getVerificationCodeShortCodeMaxLen(): number {
        return this.getVerificationCodeShortCodeExactLen();
    }

    getVerificationCodeExactLen() : number{
        return this.communicationSystemSetting.veriCodeEntityFormat.veriCodeEntityIDCharNum === undefined ? 24 : this.communicationSystemSetting.veriCodeEntityFormat.veriCodeEntityIDCharNum;
    }

    getVerificationCodeShortCodeExactLen() : number{
        return this.communicationSystemSetting.veriCodeEntityFormat.veriCodeEntityShortIDCharNum === undefined ? 5 : this.communicationSystemSetting.veriCodeEntityFormat.veriCodeEntityShortIDCharNum;
    }

    getCommunicationSystemSetting(): CommunicationSystemSetting {
        return this.communicationSystemSetting;
    }
    
    createVerificationCode<ParamType>(createInfo: VerificationCodeCreateEntity<ParamType>): Promise<VerificationCodeEntity<ParamType>> {
        return new Promise<VerificationCodeEntity<ParamType>>(
            (resolve, reject)=>{
                let generatedVeriCodeId = createInfo.isShortID ? generateRandomHexString(this.getVerificationCodeShortCodeExactLen()) : generateRandomHexString(this.getVerificationCodeExactLen());
                let createStatement = `INSERT INTO `;

                if (createInfo.isShortID) {
                    createStatement += `vericode_short_codes `
                } else {
                    createStatement += `vericode_long_codes `
                }

                createStatement += 
                `(
                    veriCodeID, 
                    isShortID,
                    relatedUser, 
                    relatedAPP, 
                    relatedMaskID, 
                    relatedAPPClientID,
                    relatedAuthToken, 
                    param, 
                    triggerClientIP, 
                    issueUTCTime, 
                    expireUTCTime
                    useScope, 
                    used, 
                    sentMethod
                ) VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                )`;

                this.mysqlConnection.execute(
                    createStatement,
                    [
                        generatedVeriCodeId,
                        createInfo.isShortID,
                        createInfo.relatedUser,
                        createInfo.relatedAPP,
                        createInfo.relatedMaskID,
                        createInfo.relatedAPPClientID,
                        createInfo.relatedOAuthToken,
                        createInfo.param,
                        createInfo.triggerClientIP,
                        createInfo.issueUTCTime,
                        createInfo.expireUTCTime,
                        createInfo.useScope,
                        createInfo.used,
                        createInfo.sentMethod
                    ],
                    (err, result, fields) =>{
                        if (err !== null) {
                            reject(convertErorToPDKStorageEngineError(err));
                        } else {
                            let returnedVeriCodeEntity:VerificationCodeEntity<ParamType> = {
                                veriCodeID : generatedVeriCodeId,
                                isShortID : createInfo.isShortID,
                                relatedUser : createInfo.relatedUser,
                                relatedAPP : createInfo.relatedAPP,
                                relatedMaskID : createInfo.relatedMaskID,
                                relatedAPPClientID : createInfo.relatedAPPClientID,
                                relatedOAuthToken : createInfo.relatedOAuthToken,
                                param : createInfo.param,
                                triggerClientIP : createInfo.triggerClientIP,
                                issueUTCTime : createInfo.issueUTCTime,
                                expireUTCTime : createInfo.expireUTCTime,
                                useScope : createInfo.useScope,
                                used : createInfo.used,
                                sentMethod : createInfo.sentMethod
                            }
                            resolve(returnedVeriCodeEntity)
                        }
                    }
                )
            }
        )
    }

    revokeCreatedVerificationCode<ParamType>(createdVeriCodeEntity: VerificationCodeEntity<ParamType>): Promise<void> {
        return new Promise<void>(
            (resolve, reject) => {
                let deleteStatement = 'DELETE FROM '

                if (createdVeriCodeEntity.isShortID) {
                    deleteStatement += `vericode_short_codes `
                } else {
                    deleteStatement += `vericode_long_codes `
                }
                deleteStatement += `WHERE veriCodeID = ?;`;

                this.mysqlConnection.execute( deleteStatement, [createdVeriCodeEntity.veriCodeID], 
                    (err, result, fields) => {
                        if (err !== null) {
                            reject(err);
                        } else {
                            if ("affectedRows" in result && result.affectedRows === 0 ) {
                                reject(new PDKItemNotFoundError<'veriCodeID'>(['veriCodeID']));
                            } else {
                                resolve();
                            }
                        }
                    }
                )
            }
        )
    }

    verifyVerificationCode(verifyInfo: VericodeFactoryMySQLVerifyInfo): Promise<boolean> {
        return new Promise<boolean> (
            (resolve, reject) => {
                let compareStatement = `SELECT count(*) as count FROM `;

                if (verifyInfo.isShortCode) {
                    compareStatement += `vericode_short_codes`;
                } else {
                    compareStatement += `vericode_long_codes`;
                }

                compareStatement += `WHERE veriCodeID = ? LIMIT 1`;

                this.mysqlConnection.execute(
                    compareStatement, 
                    [verifyInfo.code],
                    (err, result, fields) => {
                        if (err !== null) {
                            reject(convertErorToPDKStorageEngineError(err));
                        } else {
                            if ("length" in result ){
                                if ( result.length === 0 || !('count' in result[0]) ){
                                    reject (new PDKUnknownInnerError("No verify code matches"));
                                } else {
                                    resolve(result[0].count >= 1);
                                }
                            } else {
                                reject(new PDKUnknownInnerError("Unexpected datatype received when fetching MYSQL data from vericodeID System"))
                            }
                        }
                    }
                )
            }
        )
    }

    verifyAndUseVerificationCode(verifyInfo: VericodeFactoryMySQLVerifyInfo): Promise<boolean> {
        return new Promise<boolean> (
            (resolve, reject) => {
                let updateStatement = `UPDATE `

                if (verifyInfo.isShortCode) {
                    updateStatement += `vericode_short_codes`;
                } else {
                    updateStatement += `vericode_long_codes`;
                }

                updateStatement += ` SET used = 1 WHERE vericodeID = ? AND used = 0;`;

                this.mysqlConnection.execute(
                    updateStatement, 
                    [verifyInfo.code],
                    (err, result, fields) => {
                        if (err !== null) {
                            reject(convertErorToPDKStorageEngineError(err));
                        } else {
                            if ("affectedRows" in result) {
                                resolve(result.affectedRows >= 1);
                            } else {
                                reject(new PDKUnknownInnerError('Unexpected data type received when trying to verify and use verification code in VeriCode System'));
                            }
                        }
                    }
                )
            }
        )
    }

    checkVerifyInfoValid(verifyInfo: any): VericodeFactoryMySQLVerifyInfo {
        //check integrity of verifyInfo, we don't want client to pass trash data to us!
        if(typeof(verifyInfo) !== 'object' || !('code' in verifyInfo) || typeof(verifyInfo['code']) !== 'string' || !('isShortCode' in verifyInfo) || typeof(verifyInfo['isShortCode']) !== 'string'){
            throw new PDKRequestParamFormatError(['verification_code']);
        }else{
            return {
                code: verifyInfo.code,
                isShortCode: verifyInfo.isShortCode
            };
        }
    }
    
    install(params : VerificationCodeEntityFactoryInstallInfo) : Promise<void> {
        let createLongCodeTable = 
        `CREATE TABLE vericode_long_codes 
        (
            'veriCodeID' CHAR(${this.getVerificationCodeExactLen()}) NOT NULL,
            'isShortID' TINYINT(0) NOT NULL,
            'relatedUser' ${getMySQLTypeForUserUID(params.userEntityFactory)} NOT NULL,
            'relatedAPP' ${getMySQLTypeForAPPEntityUID(params.appEntityFactory)} NOT NULL,
            'relatedMaskID' ${getMySQLTypeForMaskIDUID(params.maskIDEntityFactory)} VARCHAR(100),
            'relatedAPPClientID' ${getMySQLTypeForAPPClientID(params.appEntityFactory)},
            'relatedOAuthToken' ${getMySQLTypeForOAuthToken(params.oAuthTokenEntityFactory)},
            'param' JSON,
            'triggerClientIP' VARCHAR(45),
            'issueUTCTime' INT UNSINGED,
            'expireUTCTime' INT UNSINGED,
            'useScope' VARCHAR(${this.useScopeMaxLen}),
            'used' TINYINT(1) NOT NULL,
            'sentMethod' TINYINT NOT NULL,
            PRIMATY KEY (veriCodeID)
        );`;
        let createShortCodeTable = 
        `CREATE TABLE vericode_short_codes 
        (
            'veriCodeID' CHAR(${this.getVerificationCodeShortCodeExactLen()}) NOT NULL,
            'isShortID' TINYINT(1) NOT NULL
            'relatedUser' ${getMySQLTypeForUserUID(params.userEntityFactory)} NOT NULL,
            'relatedAPP' ${getMySQLTypeForAPPEntityUID(params.appEntityFactory)} NOT NULL,
            'relatedMaskID' ${getMySQLTypeForMaskIDUID(params.maskIDEntityFactory)} VARCHAR(100),
            'relatedAPPClientID' ${getMySQLTypeForAPPClientID(params.appEntityFactory)},
            'relatedOAuthToken' ${getMySQLTypeForOAuthToken(params.oAuthTokenEntityFactory)},
            'param' JSON,
            'triggerClientIP' VARCHAR(45),
            'issueUTCTime' INT UNSINGED,
            'expireUTCTime' INT UNSINGED,
            'useScope' VARCHAR(${this.useScopeMaxLen}),
            'used' TINYINT(1) NOT NULL,
            'sentMethod' TINYINT NOT NULL,
            PRIMATY KEY (veriCodeID)
        );`;
        return new Promise((resolve, reject) => {
            this.mysqlConnection.query(
            createLongCodeTable, 
            (err, results, fields) => {
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }
                this.mysqlConnection.query(
                    createShortCodeTable,
                    (err, results, fields) => {
                        if(err !== null){
                            reject(convertErorToPDKStorageEngineError(err));
                        }
                        resolve();
                    }
                )
            })
        });
    }

    uninstall() : Promise<void>{
        let delLongTable = 'DROP TABLE vericode_long_codes';
        let delShortTable = 'DROP TABLE vericode_short_codes';
        return new Promise((resolve, reject) => {
            this.mysqlConnection.query(
            delLongTable, 
            (err, results, fields) => {
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }
                this.mysqlConnection.query(
                    delShortTable,
                    (err, results, fields) => {
                        if(err !== null){
                            reject(convertErorToPDKStorageEngineError(err));
                        }
                        resolve();
                    }
                )
            })
        });
    }

    clearData(): Promise<void> {
        let clsLongTable = 'TRUNCATE TABLE vericode_long_codes';
        let clsShortTable = 'TRUNCATE TABLE vericode_short_codes';
        return new Promise((resolve, reject) => {
            this.mysqlConnection.query(
            clsLongTable, 
            (err, results, fields) => {
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }
                this.mysqlConnection.query(
                    clsShortTable,
                    (err, results, fields) => {
                        if(err !== null){
                            reject(convertErorToPDKStorageEngineError(err));
                        }
                        resolve();
                    }
                )
            })
        });
    }
}

export {VericodeFactoryMySQL};
