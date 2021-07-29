import {AuthorizationCodeEntityFactory, AuthorizationCodeEntityFactoryInstallInfo, AuthorizationCodeCreateEntity, AuthorizationCodeEntityFactoryUsedInfo} from '@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/OAuth/AuthCode/AuthorizationCodeEntityFactory';
import { MaskUID } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/MaskID/MaskIDEntity';
import { AuthCodeChallengeType, validateAuthCodeChallenge } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/OAuth/AuthCode/AuthCodeFormat';
import { AuthorizationCodeEntity } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/OAuth/AuthCode/AuthorizationCodeEntity';
import { OAuthAuthorizationMethod } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/OAuth/OAuthAuthorizationMethod';
import { Connection } from 'mysql2';
import { OAuthScope } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/OAuth/OAuthScope';
import { APPClientID, APPUID } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/RegisteredAPP/APPEntityFormat';
import { OAuthSystemSetting } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/SystemSetting/OAuthSystemSetting';
import { SearchResult } from '@interactiveplus/pdk2021-common/dist/InternalDataTypes/SearchResult';
import { getMySQLTypeForAPPClientID, getMySQLTypeForAPPEntityUID, getMySQLTypeForMaskIDUID } from './Utils/MySQLTypeUtil';
import { convertErorToPDKStorageEngineError } from './Utils/MySQLErrorUtil';
import { generateRandomHexString } from '@interactiveplus/pdk2021-common/dist/Utilities/HEXString';
import {  PDKInnerArgumentError, PDKUnknownInnerError } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Error/PDKException';
import { fetchMySQL } from './Utils/MySQLFetchUtil';
import { convertMySQLOAuthScopesToOAuthScopes, convertOAuthScopesToMySQLOAuthScopes } from './OAuthTokenFactoryMySQL';

interface OAuthAuthCodeFactoryMySQLVerifyInfo{
    authCode: string
}

export type {OAuthAuthCodeFactoryMySQLVerifyInfo};

function convertAuthMethodToMySQL(AuthMethod: OAuthAuthorizationMethod) : number{
    switch(AuthMethod){
        case 'Backend':
            return 1;
        case 'PKCE':
            return 2;
        default:
            throw new PDKInnerArgumentError(['AuthMethod']);
    }
}

function convertAuthMethodFromMySQL(MySQLAuthMethod : number) : OAuthAuthorizationMethod{
    switch(MySQLAuthMethod){
        case 1:
            return 'Backend';
        case 2:
            return 'PKCE';
        default:
            throw new PDKInnerArgumentError(['MySQLAuthMethod']);
    }
}

function convertAuthChallengeTypeToMySQL(challengeType : AuthCodeChallengeType) : number{
    switch(challengeType){
        case 'NONE':
            return 0;
        case 'PLAIN':
            return 1;
        case 'S256':
            return 2;
        default:
            throw new PDKInnerArgumentError(['challengeType']);
    }
}

function convertAuthChallengeTypeFromMySQL(mysqlChallengeType : number) : AuthCodeChallengeType{
    switch(mysqlChallengeType){
        case 0:
            return 'NONE';
        case 1:
            return 'PLAIN';
        case 2:
            return 'S256';
        default:
            throw new PDKInnerArgumentError(['mysqlChallengeType']);
    }
}

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


    async createAuthCode(authCodeInfo: AuthorizationCodeCreateEntity): Promise<AuthorizationCodeEntity> {
        const reRollAuthCode = async (maxCallStack?: number) : Promise<string> => {
            let loopTime = 0;
            let currentAuthCode : string = generateRandomHexString(this.getOAuthCodeExactLength());
            while(maxCallStack === undefined || loopTime < maxCallStack){
                let currentExistance = await this.checkAuthorizationCodeExist(currentAuthCode);
                if(!currentExistance){
                    return currentAuthCode;
                }else{
                    currentAuthCode = generateRandomHexString(this.getOAuthCodeExactLength());
                }
                loopTime++;
            }
            throw new PDKUnknownInnerError('Rerolled ' + loopTime.toString() + ' times of OAuth AuthCode but none of them can be stored because there already exists same Auth Code');
        }
        let rolledAuthCode : string = await reRollAuthCode();
        let insertStatement = 
        `INSERT INTO oauth_auth_codes 
        (
            auth_code,
            auth_method,
            issue_time,
            expire_time,
            user_remote_addr,
            appuid,
            client_id,
            mask_uid,
            challenge_type,
            used,
            scopes,
            code_challenge
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
            ?
        );`;
        await fetchMySQL(
            this.mysqlConnection,
            insertStatement,
            [
                rolledAuthCode,
                authCodeInfo.authMethod,
                authCodeInfo.issueTimeGMT,
                authCodeInfo.expireTimeGMT,
                authCodeInfo.grantUserRemoteAddr,
                authCodeInfo.appUID,
                authCodeInfo.clientID,
                authCodeInfo.maskUID,
                convertAuthChallengeTypeToMySQL(authCodeInfo.challengeType),
                authCodeInfo.used ? 1 : 0,
                convertOAuthScopesToMySQLOAuthScopes(authCodeInfo.scopes),
                authCodeInfo.codeChallenge
            ],
            true
        );
        let createdEntity : AuthorizationCodeEntity = Object.assign({
            authCode: rolledAuthCode
        }, authCodeInfo);
        return createdEntity;
    }

    getAuthCodeFromDBRow(dbRow : any) : AuthorizationCodeEntity{
        if(
            !('auth_code' in dbRow)
            || !('auth_method' in dbRow)
            || !('issue_time' in dbRow)
            || !('expire_time' in dbRow)
            || !('user_remote_addr' in dbRow)
            || !('client_id' in dbRow)
            || !('mask_uid' in dbRow)
            || !('challenge_type' in dbRow)
            || !('used' in dbRow)
            || !('scopes' in dbRow)
        ){
            throw new PDKInnerArgumentError(['dbRow'],'Unexpected data type received when trying to parse MySQL Row to AuthCodeEntity');
        }
        return {
            authCode: dbRow['auth_code'],
            authMethod: convertAuthMethodFromMySQL(dbRow['auth_method']),
            issueTimeGMT: dbRow['issue_time'],
            expireTimeGMT: dbRow['expire_time'],
            grantUserRemoteAddr: dbRow['user_remote_addr'],
            appUID: (dbRow['appuid'] === null || dbRow['appuid'] === undefined) ? undefined : dbRow['appuid'],
            clientID: dbRow['client_id'],
            maskUID: dbRow['mask_uid'],
            challengeType: convertAuthChallengeTypeFromMySQL(dbRow['challenge_type']),
            used: dbRow['used'] === 0 ? false : true,
            scopes: convertMySQLOAuthScopesToOAuthScopes(dbRow['scopes']),
            codeChallenge: (dbRow['code_challenge'] === null || dbRow['code_challenge'] === undefined) ? undefined : dbRow['coode_challenge']
        };
    }

    async findAuthCode(authCode : string, authMethod?: OAuthAuthorizationMethod, clientID?: string, maskUID?: MaskUID) : Promise<AuthorizationCodeEntity | undefined>{
        let selectStatement = 'SELECT * FROM oauth_auth_codes';
        let allParams : any[] = [];

        selectStatement += ' WHERE auth_code = ?';
        allParams.push(authCode);

        if(authMethod !== undefined){
            selectStatement += ' AND auth_method = ?';
            allParams.push(convertAuthMethodToMySQL(authMethod));
        }

        if(clientID !== undefined){
            selectStatement += ' AND client_id = ?';
            allParams.push(clientID);
        }

        if(maskUID !== undefined){
            selectStatement += ' AND mask_uid = ?';
            allParams.push(maskUID);
        }

        selectStatement += ' LIMIT 1';

        let fetchedData = await fetchMySQL(this.mysqlConnection,selectStatement,allParams,true);
        if(!('length' in fetchedData.result)){
            throw new PDKUnknownInnerError('Unexpected data type received when fetching AuthCodeEntity');
        }else if(fetchedData.result.length < 1){
            return undefined;
        }
        return this.getAuthCodeFromDBRow(fetchedData.result[0]);
    }
    async verifyAuthCode(authCode: string, authMethod?: OAuthAuthorizationMethod, clientID?: string, maskUID?: MaskUID, codeVerifier?: string): Promise<boolean> {
        let fetchedAuthCode = await this.findAuthCode(authCode,authMethod,clientID,maskUID);
        if(fetchedAuthCode === undefined){
            return false;
        }
        //check code_verifier validity
        if(!validateAuthCodeChallenge(fetchedAuthCode.challengeType,fetchedAuthCode.codeChallenge,codeVerifier)){
            return false;
        }
        //check auth code validity
        let currentSecGMT = Math.round(Date.now() / 1000);
        if(fetchedAuthCode.used || fetchedAuthCode.expireTimeGMT <= currentSecGMT){
            //throw new PDKItemExpiredOrUsedError(['oauth_auth_code']);
            return false;
        }
        return true;
    }
    async verifyAndUseAuthCode(authCode: string, authMethod?: OAuthAuthorizationMethod, clientID?: string, maskUID?: MaskUID, codeVerifier?: string): Promise<AuthorizationCodeEntityFactoryUsedInfo | undefined> {
        let fetchedAuthCode = await this.findAuthCode(authCode,authMethod,clientID,maskUID);
        if(fetchedAuthCode === undefined){
            return undefined;
        }
        //check code_verifier validity
        if(!validateAuthCodeChallenge(fetchedAuthCode.challengeType,fetchedAuthCode.codeChallenge,codeVerifier)){
            return undefined;
        }
        //check auth code validity
        let currentSecGMT = Math.round(Date.now() / 1000);
        if(fetchedAuthCode.used || fetchedAuthCode.expireTimeGMT <= currentSecGMT){
            //throw new PDKItemExpiredOrUsedError(['oauth_auth_code']);
            return undefined;
        }
        
        let updateAuthCodeStatement = 'UPDATE oauth_auth_codes SET used = 1 WHERE auth_code = ?';
        await fetchMySQL(this.mysqlConnection, updateAuthCodeStatement,[fetchedAuthCode.authCode],true);
        return {
            authMethod: fetchedAuthCode.authMethod,
            grantUserRemoteAddr: fetchedAuthCode.grantUserRemoteAddr,
            clientID: fetchedAuthCode.clientID,
            maskUID: fetchedAuthCode.maskUID,
            scopes: fetchedAuthCode.scopes
        };
    }
    async getAuthorizationCode(authCode : string) : Promise<AuthorizationCodeEntity | undefined>{
        return await this.findAuthCode(authCode);
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
    scopes TINYINT NOT NULL,
    code_challenge VARCHAR(${codeChallengeMaxLen}),
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