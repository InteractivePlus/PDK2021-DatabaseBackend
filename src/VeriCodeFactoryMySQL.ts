import {Connection} from 'mysql2';
import {VerificationCodeEntityFactory, VerificationCodeCreateEntity, VerificationCodeEntityFactoryInstallInfo} from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/Communication/VerificationCode/VerificationCodeEntityFactory";
import {VerificationCodeEntity} from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Communication/VerificationCode/VerificationCodeEntity"
import { BackendCommunicationSystemSetting } from '@interactiveplus/pdk2021-backendcore/dist/AbstractDataTypes/SystemSetting/BackendCommunicationSystemSetting';
import { CommunicationSystemSetting } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/SystemSetting/CommunicationSystemSetting';
import { getMySQLTypeForAPPClientID, getMySQLTypeForAPPEntityUID, getMySQLTypeForMaskIDUID, getMySQLTypeForOAuthToken, getMySQLTypeForUserUID } from './Utils/MySQLTypeUtil';
import { convertErorToPDKStorageEngineError } from './Utils/MySQLErrorUtil';

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
        throw new Error('Method not implemented.');
    }
    revokeCreatedVerificationCode<ParamType>(createdVeriCodeEntity: VerificationCodeEntity<ParamType>): Promise<void> {
        throw new Error('Method not implemented.');
    }
    verifyVerificationCode(verifyInfo: VericodeFactoryMySQLVerifyInfo): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    verifyAndUseVerificationCode(verifyInfo: VericodeFactoryMySQLVerifyInfo): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    checkVerifyInfoValid(verifyInfo: any): VericodeFactoryMySQLVerifyInfo {
        throw new Error('Method not implemented.');
    }
    
    install(params : VerificationCodeEntityFactoryInstallInfo) : Promise<void> {
        let createLongCodeTable = 
        `CREATE TABLE vericode_long_codes 
        (
            'veriCodeID' VARCHAR(${this.getVerificationCodeExactLen()}) NOT NULL,
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
            'veriCodeID' VARCHAR(${this.getVerificationCodeShortCodeExactLen()}) NOT NULL,
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