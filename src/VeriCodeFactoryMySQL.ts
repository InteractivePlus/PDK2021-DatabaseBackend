import mysql, {Connection} from 'mysql2';
import {VerificationCodeEntityFactory, VerificationCodeCreateEntity} from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/Communication/VerificationCode/VerificationCodeEntityFactory";
import {VerificationCodeEntity} from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Communication/VerificationCode/VerificationCodeEntity"
import { BackendCommunicationSystemSetting } from '@interactiveplus/pdk2021-backendcore/dist/AbstractDataTypes/SystemSetting/BackendCommunicationSystemSetting';

interface VericodeFactoryMySQLVerifyInfo{
    code: string,
    isShortCode: boolean
}

class VericodeFactoryMySQL implements VerificationCodeEntityFactory<VericodeFactoryMySQLVerifyInfo>{
    constructor(public mysqlConnection:Connection, private communicationSystemSetting : BackendCommunicationSystemSetting) {}

    getCommunicationSystemSetting(): BackendCommunicationSystemSetting{
        return this.communicationSystemSetting;
    }

    createVerificationCode<ParamType>(createInfo: VerificationCodeCreateEntity<ParamType>): Promise<VerificationCodeEntity<ParamType>>{
        
    };
    revokeCreatedVerificationCode<ParamType>(createdVeriCodeEntity: VerificationCodeEntity<ParamType>): Promise<void>;
    verifyVerificationCode(verifyInfo: VericodeFactoryMySQLVerifyInfo): boolean;
    verifyAndUseVerificationCode(verifyInfo: VericodeFactoryMySQLVerifyInfo): boolean;
    
    checkVerifyInfoValid(verifyInfo: any): VericodeFactoryMySQLVerifyInfo{
        
    }
    // getVerificationCode?(veriCodeID: VeriCodeEntityID): VerificationCodeEntity<unknown> | undefined;
    // updateVerificationCode?<ParamType>(veriCodeID: VeriCodeEntityID, veriCode: VerificationCodeEntity<ParamType>, oldVeriCode?: VerificationCodeEntity<ParamType>): void;
    // deleteVerificationCode?(veriCodeID: VeriCodeEntityID): void;
    // checkVerificationCodeExist?(veriCodeID: VeriCodeEntityID): boolean;
    // getVerificationCodeCont?(veriCodeID?: VeriCodeEntityID, isShortID?: boolean, relatedUser?: UserEntityUID, relatedAPP?: APPUID, relatedMaskID?: MaskUID, relatedAPPClientID?: APPClientID, relatedAPPOAuthToken?: OAuthAccessToken, triggerClientIP?: string, issueUTCTimeMin?: number, issueUTCTimeMax?: number, expireUTCTimeMin?: number, expireUTCTimeMax?: number, useScope?: string | number, used?: boolean, sentMethod?: CommunicationMethodWithNone): number;
    // searchVerificationCode?(veriCodeID?: VeriCodeEntityID, isShortID?: boolean, relatedUser?: UserEntityUID, relatedAPP?: APPUID, relatedMaskID?: MaskUID, relatedAPPClientID?: APPClientID, relatedAPPOAuthToken?: OAuthAccessToken, triggerClientIP?: string, issueUTCTimeMin?: number, issueUTCTimeMax?: number, expireUTCTimeMin?: number, expireUTCTimeMax?: number, useScope?: string | number, used?: boolean, sentMethod?: CommunicationMethodWithNone, numLimit?: number, startPosition?: number): SearchResult<VerificationCodeEntity<unknown>>;
    // clearVerificationCode?(veriCodeID?: VeriCodeEntityID, isShortID?: boolean, relatedUser?: UserEntityUID, relatedAPP?: APPUID, relatedMaskID?: MaskUID, relatedAPPClientID?: APPClientID, relatedAPPOAuthToken?: OAuthAccessToken, triggerClientIP?: string, issueUTCTimeMin?: number, issueUTCTimeMax?: number, expireUTCTimeMin?: number, expireUTCTimeMax?: number, useScope?: string | number, used?: boolean, sentMethod?: CommunicationMethodWithNone, numLimit?: number, startPosition?: number): SearchResult<VerificationCodeEntity<unknown>>;

    install() : Promise<void> {
        //SHA1
        let tableCommand = `CREATE TABLE verifyCode 
                            (   
                                'veriCodeID' VARCHAR(100),
                                'isShortID' TINYINT(1) NOT NULL,
                                'relatedUser' VARCHAR(100),
                                'relatedAPP' VARCHAR(100),
                                'relatedMaskID' VARCHAR(100),
                                'relatedAPPClientID' VARCHAR(100),
                                'relatedOAuthToken' VARCHAR(100),
                                'param' JSON,
                                'triggerClientIP' VARCHAR(45),
                                'issueUTCTime' INT UNSINGED,
                                'expireUTCTime' INT UNSINGED,
                                'useScope' VARCHAR(100),
                                'used' TINYINT(1) NOT NULL,
                                'sentMethod' TINYINT NOT NULL,
                                PRIMATY KEY (veriCodeID)
                            );`;
        return new Promise((resolve, reject) => {
            this.mysqlConnection.query(
            tableCommand, 
            function(err, results, fields) {
                if(err !== null){
                    reject(err);
                }else{
                    resolve(undefined);
                }
            })
        });
    }
}