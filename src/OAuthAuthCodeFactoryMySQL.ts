import {AuthorizationCodeEntityFactory, AuthorizationCodeEntityFactoryInstallInfo, AuthorizationCodeCreateEntity} from '@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/OAuth/AuthCode/AuthorizationCodeEntityFactory';
import { MaskUID } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/MaskID/MaskIDEntity';
import { AuthCodeChallengeType } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/OAuth/AuthCode/AuthCodeFormat';
import { AuthorizationCodeEntity } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/OAuth/AuthCode/AuthorizationCodeEntity';
import { OAuthAuthorizationMethod } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/OAuth/OAuthAuthorizationMethod';
import { Connection } from 'mysql2';
import { OAuthScope } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/OAuth/OAuthScope';
import { APPClientID, APPUID } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/RegisteredAPP/APPEntityFormat';
import { OAuthSystemSetting } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/SystemSetting/OAuthSystemSetting';
import { SearchResult } from '@interactiveplus/pdk2021-common/dist/InternalDataTypes/SearchResult';
import { getMySQLTypeForAPPClientID, getMySQLTypeForAPPEntityUID, getMySQLTypeForMaskIDUID } from './Utils/MySQLTypeUtil';
import { convertErorToPDKStorageEngineError } from './Utils/MySQLErrorUtil';

interface OAuthAuthCodeFactoryMySQLVerifyInfo{
    authCode: string
}

export type {OAuthAuthCodeFactoryMySQLVerifyInfo};

class OAuthAuthCodeFactoryMySQL implements AuthorizationCodeEntityFactory{
    constructor(public mysqlConnection : Connection, protected oAuthSystemSetting : OAuthSystemSetting){

    }
    
    getOAuthCodeMaxLength(): number {
        return this.getOAuthCodeExactLength();
    }
    getOAuthCodeExactLength() : number{
        return this.oAuthSystemSetting.authCodeEntityFormat.authCodeCharNum !== undefined ? this.oAuthSystemSetting.authCodeEntityFormat.authCodeCharNum : 16;
    }
    getOAuthSystemSetting(): OAuthSystemSetting {
        return this.oAuthSystemSetting;
    }


    createAuthCode(authCodeInfo: AuthorizationCodeCreateEntity): Promise<AuthorizationCodeEntity> {
        throw new Error('Method not implemented.');
    }
    verifyAuthCode(authCode: string, authMethod?: OAuthAuthorizationMethod, clientID?: string, maskUID?: MaskUID, codeVerifier?: string): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    verifyAndUseAuthCode(authCode: string, authMethod?: OAuthAuthorizationMethod, clientID?: string, maskUID?: MaskUID, codeVerifier?: string): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    getAuthorizationCode(authCode : string) : Promise<AuthorizationCodeEntity | undefined>{
        throw new Error('Method not implemented.');
    }
    updateAuthorizationCode(authCode : string, authCodeEntity : AuthorizationCodeEntity, oldAuthCodeEntity?: AuthorizationCodeEntity) : Promise<void>{
        throw new Error('Method not implemented.');
    }
    deleteAuthorizationCode(authCode : string) : Promise<void>{
        throw new Error('Method not implemented.');
    }

    checkAuthorizationCodeExist(authCode : string) : Promise<boolean>{
        throw new Error('Method not implemented.');
    }
    getAuthorizationCodeCount(
        authCode?: string,
        authMethod?: OAuthAuthorizationMethod,
        issueTimeGMTMin?: number,
        issueTimeGMTMax?: number,
        expireTimeGMTMin?: number,
        expireTimeGMTMax?: number,
        grantUserRemoteAddr?: string,
        appUID?: APPUID,
        clientID?: APPClientID,
        maskUID?: MaskUID,
        challengeType?: AuthCodeChallengeType,
        used?: boolean,
        scopes?: OAuthScope[],
        codeChallenge?: string
    ) : Promise<number>{
        throw new Error('Method not implemented.');
    }
    searchAuthorizationCode(
        authCode?: string,
        authMethod?: OAuthAuthorizationMethod,
        issueTimeGMTMin?: number,
        issueTimeGMTMax?: number,
        expireTimeGMTMin?: number,
        expireTimeGMTMax?: number,
        grantUserRemoteAddr?: string,
        appUID?: APPUID,
        clientID?: APPClientID,
        maskUID?: MaskUID,
        challengeType?: AuthCodeChallengeType,
        used?: boolean,
        scopes?: OAuthScope[],
        codeChallenge?: string,
        numLimit?: number,
        startPosition?: number
    ) : Promise<SearchResult<AuthorizationCodeEntity>>{
        throw new Error('Method not implemented.');
    }
    clearAuthorizationCode(
        authCode?: string,
        authMethod?: OAuthAuthorizationMethod,
        issueTimeGMTMin?: number,
        issueTimeGMTMax?: number,
        expireTimeGMTMin?: number,
        expireTimeGMTMax?: number,
        grantUserRemoteAddr?: string,
        appUID?: APPUID,
        clientID?: APPClientID,
        maskUID?: MaskUID,
        challengeType?: AuthCodeChallengeType,
        used?: boolean,
        scopes?: OAuthScope[],
        codeChallenge?: string,
        numLimit?: number,
        startPosition?: number
    ) : Promise<void>{
        throw new Error('Method not implemented.');
    }

    install(params: AuthorizationCodeEntityFactoryInstallInfo): Promise<void> {
        const SHA256_LEN = 64;    
        const codeChallengeMaxLen = Math.max(this.oAuthSystemSetting.authCodeEntityFormat.codeChallengeMaxLen,SHA256_LEN);    

        let createTableStatement = 
`CREATE TABLE oauth_auth_codes 
(
    auth_code CHAR(${this.getOAuthCodeExactLength()}) NOT NULL,
    auth_method TINYINT NOT NULL,
    issue_time INT NOT NULL,
    expire_time INT NOT NULL,
    user_remote_addr VARCHAR(45) NOT NULL,
    appuid ${getMySQLTypeForAPPEntityUID(params.appEntityFactory)},
    client_id ${getMySQLTypeForAPPClientID(params.appEntityFactory)} NOT NULL,
    mask_uid ${getMySQLTypeForMaskIDUID(params.maskIDEntityFactory)} NOT NULL,
    challenge_type TINYINT NOT NULL,
    used TINYINT(1) NOT NULL,
    scopes TINYINT SET,
    codeChallenge VARCHAR(${codeChallengeMaxLen}),
    PRIMARY KEY (auth_code)
);`;
        return new Promise<void>((resolve,reject)=>{
            this.mysqlConnection.query(createTableStatement,(err,result,fields)=>{
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }else{
                    resolve();
                }
            })
        })
    }
    uninstall(): Promise<void> {
        let dropTableStatement = `DROP TABLE oauth_auth_codes;`;
        return new Promise<void>((resolve,reject)=>{
            this.mysqlConnection.query(dropTableStatement,(err,result,fields)=>{
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }else{
                    resolve();
                }
            })
        })
    }
    clearData(): Promise<void> {
        let clsTableStatement = `TRUNCATE TABLE oauth_auth_codes;`;
        return new Promise<void>((resolve,reject)=>{
            this.mysqlConnection.query(clsTableStatement,(err,result,fields)=>{
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }else{
                    resolve();
                }
            })
        })
    }
}

export {OAuthAuthCodeFactoryMySQL};