import mysql, {Connection} from 'mysql2';
import {VerificationCodeEntityFactory, VerificationCodeCreateEntity} from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/Communication/VerificationCode/VerificationCodeEntityFactory";
import {VerificationCodeEntity} from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Communication/VerificationCode/VerificationCodeEntity"
import { BackendCommunicationSystemSetting } from '../../PDK2021-BackendCore/dist/AbstractDataTypes/SystemSetting/BackendCommunicationSystemSetting';

class vericodeMysql implements VerificationCodeEntityFactory<any>{
    constructor(public mysqlConnection:Connection) {}

    // getCommunicationSystemSetting(): BackendCommunicationSystemSetting;
    // createVerificationCode<ParamType>(createInfo: VerificationCodeCreateEntity<ParamType>): VerificationCodeEntity<ParamType>;
    // revokeCreatedVerificationCode<ParamType>(createdVeriCodeEntity: VerificationCodeEntity<ParamType>): void;
    // verifyVerificationCode(verifyInfo: VerifyCodeInfo): boolean;
    // verifyAndUseVerificationCode(verifyInfo: VerifyCodeInfo): boolean;
    // /**
    //  * Check if verifyInfo is in correct format
    //  * @param verifyInfo struct passed by client
    //  * @returns {VerifyCodeInfo} Parsed CodeInfo
    //  * @throws {PDKRequestParamFormatError}
    //  */
    // checkVerifyInfoValid(verifyInfo: any): VerifyCodeInfo;
    // getVerificationCode?(veriCodeID: VeriCodeEntityID): VerificationCodeEntity<unknown> | undefined;
    // updateVerificationCode?<ParamType>(veriCodeID: VeriCodeEntityID, veriCode: VerificationCodeEntity<ParamType>, oldVeriCode?: VerificationCodeEntity<ParamType>): void;
    // deleteVerificationCode?(veriCodeID: VeriCodeEntityID): void;
    // checkVerificationCodeExist?(veriCodeID: VeriCodeEntityID): boolean;
    // getVerificationCodeCont?(veriCodeID?: VeriCodeEntityID, isShortID?: boolean, relatedUser?: UserEntityUID, relatedAPP?: APPUID, relatedMaskID?: MaskUID, relatedAPPClientID?: APPClientID, relatedAPPOAuthToken?: OAuthAccessToken, triggerClientIP?: string, issueUTCTimeMin?: number, issueUTCTimeMax?: number, expireUTCTimeMin?: number, expireUTCTimeMax?: number, useScope?: string | number, used?: boolean, sentMethod?: CommunicationMethodWithNone): number;
    // searchVerificationCode?(veriCodeID?: VeriCodeEntityID, isShortID?: boolean, relatedUser?: UserEntityUID, relatedAPP?: APPUID, relatedMaskID?: MaskUID, relatedAPPClientID?: APPClientID, relatedAPPOAuthToken?: OAuthAccessToken, triggerClientIP?: string, issueUTCTimeMin?: number, issueUTCTimeMax?: number, expireUTCTimeMin?: number, expireUTCTimeMax?: number, useScope?: string | number, used?: boolean, sentMethod?: CommunicationMethodWithNone, numLimit?: number, startPosition?: number): SearchResult<VerificationCodeEntity<unknown>>;
    // clearVerificationCode?(veriCodeID?: VeriCodeEntityID, isShortID?: boolean, relatedUser?: UserEntityUID, relatedAPP?: APPUID, relatedMaskID?: MaskUID, relatedAPPClientID?: APPClientID, relatedAPPOAuthToken?: OAuthAccessToken, triggerClientIP?: string, issueUTCTimeMin?: number, issueUTCTimeMax?: number, expireUTCTimeMin?: number, expireUTCTimeMax?: number, useScope?: string | number, used?: boolean, sentMethod?: CommunicationMethodWithNone, numLimit?: number, startPosition?: number): SearchResult<VerificationCodeEntity<unknown>>;

    creatTable() {
        //SHA1
        let tableCommand = `CREATE TABLE verifyCode 
                            (   
                                'veriCodeID' TEXT,
                                'isShortID' BOOLEAN NOT NULL DEFAULT 0,
                                'relatedUser' VARCHAR(100),
                                'relatedAPP' VARCHAR(100),
                                'relatedMaskID' VARCHAR(100),
                                'relatedAPPClientID' VARCHAR(100),
                                'relatedOAuthToken' VARCHAR(100),
                                'param' JSON NOT NULL,
                                'triggerClientIP' TEXT,
                                'issueUTCTime' INT UNSINGED,
                                'expireUTCTime' INT UNSINGED,
                                'useScope' VARCHAR(100),
                                'used' BOOLEAN NOT NULL DEFAULT 0,
                                'sentMethod' JSON NOT NULL,
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