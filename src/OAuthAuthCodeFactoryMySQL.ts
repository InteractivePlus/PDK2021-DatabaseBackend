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
import {  PDKInnerArgumentError, PDKItemNotFoundError, PDKUnknownInnerError } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Error/PDKException';
import { fetchMySQL } from './Utils/MySQLFetchUtil';
import { convertMySQLOAuthScopesToOAuthScopes, convertOAuthScopesToMySQLOAuthScopes, convertOAuthScopeToMySQLOAuthScope } from './OAuthTokenFactoryMySQL';

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
    async updateAuthorizationCode(authCode : string, authCodeEntity : AuthorizationCodeEntity, oldAuthCodeEntity?: AuthorizationCodeEntity) : Promise<void>{
        let updateStatement = 
        `UPDATE oauth_auth_codes SET 
        auth_method = ?,
        issue_time = ?,
        expire_time = ?,
        user_remote_addr = ?,
        appuid = ?,
        client_id = ?,
        mask_uid = ?,
        challenge_type = ?,
        used = ?,
        scopes = ?,
        code_challenge = ?
        WHERE auth_code = ?;`;
        let fetchResult = await fetchMySQL(
            this.mysqlConnection,
            updateStatement,
            [
                convertAuthMethodToMySQL(authCodeEntity.authMethod),
                authCodeEntity.issueTimeGMT,
                authCodeEntity.expireTimeGMT,
                authCodeEntity.grantUserRemoteAddr,
                authCodeEntity.appUID,
                authCodeEntity.clientID,
                authCodeEntity.maskUID,
                convertAuthChallengeTypeToMySQL(authCodeEntity.challengeType),
                authCodeEntity.used ? 1 : 0,
                convertOAuthScopesToMySQLOAuthScopes(authCodeEntity.scopes),
                authCodeEntity.codeChallenge,
                authCode
            ],
            true
        );
        if(!('affectedRows' in fetchResult.result)){
            throw new PDKUnknownInnerError('Unexpected data type received when updating data in OAuth AuthCode System');
        }
        if(fetchResult.result.affectedRows < 1){
            throw new PDKItemNotFoundError(['oauth_auth_code']);
        }
        return;
    }
    async deleteAuthorizationCode(authCode : string) : Promise<void>{
        let delStatement = "DELETE FROM oauth_auth_codes WHERE auth_code = ?;";
        let delResult = await fetchMySQL(this.mysqlConnection,delStatement,[authCode],true);
        if(!('affectedRows' in delResult.result)){
            throw new PDKUnknownInnerError('Unexpected data type received when deleting data in OAuth AuthCode System');
        }
        if(delResult.result.affectedRows < 1){
            throw new PDKItemNotFoundError(['oauth_auth_code']);
        }
        return;
    }

    async checkAuthorizationCodeExist(authCode : string) : Promise<boolean>{
        let selectStatement = "SELECT count(*) as count FROM oauth_auth_codes WHERE auth_code = ?;";
        let fetchResult = await fetchMySQL(this.mysqlConnection,selectStatement,[authCode],true);
        if(!('length' in fetchResult.result) || fetchResult.result.length < 1 || !('count' in fetchResult.result[0])){
            throw new PDKUnknownInnerError('Unexpected data type received when fetching data in OAuth AuthCode System');
        }
        return fetchResult.result[0].count >= 1;
    }
    async getAuthorizationCodeCount(
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
        let selectStatement = 'SELECT count(*) as count FROM oauth_auth_codes';
        let allWhereClauses : string[] = [];
        let allParams : any[] = [];
        if(authCode !== undefined){
            allWhereClauses.push('auth_code = ?');
            allParams.push(authCode);
        }
        if(authMethod !== undefined){
            allWhereClauses.push('auth_method = ?');
            allParams.push(convertAuthMethodToMySQL(authMethod));
        }
        if(issueTimeGMTMin !== undefined){
            allWhereClauses.push('issue_time >= ?');
            allParams.push(issueTimeGMTMin);
        }
        if(issueTimeGMTMax !== undefined){
            allWhereClauses.push('issue_time <= ?');
            allParams.push(issueTimeGMTMax);
        }
        if(expireTimeGMTMin !== undefined){
            allWhereClauses.push('expire_time >= ?');
            allParams.push(expireTimeGMTMin);
        }
        if(expireTimeGMTMax !== undefined){
            allWhereClauses.push('expire_time <= ?');
            allParams.push(expireTimeGMTMax);
        }
        if(grantUserRemoteAddr !== undefined){
            allWhereClauses.push('user_remote_addr LIKE ?');
            allParams.push('%' + grantUserRemoteAddr + '%');
        }
        if(appUID !== undefined){
            allWhereClauses.push('appuid = ?');
            allParams.push(appUID);
        }
        if(clientID !== undefined){
            allWhereClauses.push('client_id = ?');
            allParams.push(clientID);
        }
        if(maskUID !== undefined){
            allWhereClauses.push('mask_uid = ?');
            allParams.push(maskUID);
        }
        if(challengeType !== undefined){
            allWhereClauses.push('challenge_type = ?');
            allParams.push(convertAuthChallengeTypeToMySQL(challengeType));
        }
        if(used !== undefined){
            allWhereClauses.push('used = ?');
            allParams.push(used ? 1 : 0);
        }
        if(scopes !== undefined){
            for(let i=0; i<scopes.length;i++){
                let scope = scopes[i];

                allWhereClauses.push('(scopes & ?) != 0');
                allParams.push(convertOAuthScopeToMySQLOAuthScope(scope));
            }
        }
        if(codeChallenge !== undefined){
            allWhereClauses.push('code_challenge = ?');
            allParams.push(codeChallenge);
        }

        selectStatement += allWhereClauses.length >= 1 ? ' WHERE ' + allWhereClauses.join(' AND ') : '';
        selectStatement += ';';

        let fetchResult = await fetchMySQL(this.mysqlConnection,selectStatement,allParams,true);
        if(!('length' in fetchResult.result) || fetchResult.result.length < 1 || !('count' in fetchResult.result[0])){
            throw new PDKUnknownInnerError('Unexpected data type received when fetching data in OAuth AuthCode System');
        }
        return fetchResult.result[0].count;
    }
    async searchAuthorizationCode(
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
        let selectStatement = 'SELECT * FROM oauth_auth_codes';
        let allWhereClauses : string[] = [];
        let allParams : any[] = [];
        if(authCode !== undefined){
            allWhereClauses.push('auth_code = ?');
            allParams.push(authCode);
        }
        if(authMethod !== undefined){
            allWhereClauses.push('auth_method = ?');
            allParams.push(convertAuthMethodToMySQL(authMethod));
        }
        if(issueTimeGMTMin !== undefined){
            allWhereClauses.push('issue_time >= ?');
            allParams.push(issueTimeGMTMin);
        }
        if(issueTimeGMTMax !== undefined){
            allWhereClauses.push('issue_time <= ?');
            allParams.push(issueTimeGMTMax);
        }
        if(expireTimeGMTMin !== undefined){
            allWhereClauses.push('expire_time >= ?');
            allParams.push(expireTimeGMTMin);
        }
        if(expireTimeGMTMax !== undefined){
            allWhereClauses.push('expire_time <= ?');
            allParams.push(expireTimeGMTMax);
        }
        if(grantUserRemoteAddr !== undefined){
            allWhereClauses.push('user_remote_addr LIKE ?');
            allParams.push('%' + grantUserRemoteAddr + '%');
        }
        if(appUID !== undefined){
            allWhereClauses.push('appuid = ?');
            allParams.push(appUID);
        }
        if(clientID !== undefined){
            allWhereClauses.push('client_id = ?');
            allParams.push(clientID);
        }
        if(maskUID !== undefined){
            allWhereClauses.push('mask_uid = ?');
            allParams.push(maskUID);
        }
        if(challengeType !== undefined){
            allWhereClauses.push('challenge_type = ?');
            allParams.push(convertAuthChallengeTypeToMySQL(challengeType));
        }
        if(used !== undefined){
            allWhereClauses.push('used = ?');
            allParams.push(used ? 1 : 0);
        }
        if(scopes !== undefined){
            for(let i=0; i<scopes.length;i++){
                let scope = scopes[i];

                allWhereClauses.push('(scopes & ?) != 0');
                allParams.push(convertOAuthScopeToMySQLOAuthScope(scope));
            }
        }
        if(codeChallenge !== undefined){
            allWhereClauses.push('code_challenge = ?');
            allParams.push(codeChallenge);
        }
        selectStatement += allWhereClauses.length >= 1 ? ' WHERE ' + allWhereClauses.join(' AND ') : '';
        if(numLimit !== undefined){
            selectStatement += ' LIMIT ' + numLimit.toString();
        }
        if(startPosition !== undefined){
            selectStatement += ' OFFSET ' + startPosition.toString();
        }
        let fetchResult = await fetchMySQL(this.mysqlConnection,selectStatement,allParams,true);
        if(!('length' in fetchResult.result)){
            throw new PDKUnknownInnerError('Unexpected data type received when fetching data from OAuth AuthCode System');
        }
        
        let allParsedEntities : AuthorizationCodeEntity[] = [];

        for(let i = 0; i < fetchResult.result.length; i++){
            let currentRow = fetchResult.result[i];
            allParsedEntities.push(this.getAuthCodeFromDBRow(currentRow));
        }
        return new SearchResult(allParsedEntities.length,allParsedEntities);
    }
    async clearAuthorizationCode(
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
        let deleteStatement = 'DELETE FROM oauth_auth_codes';
        let allWhereClauses : string[] = [];
        let allParams : any[] = [];
        if(authCode !== undefined){
            allWhereClauses.push('auth_code = ?');
            allParams.push(authCode);
        }
        if(authMethod !== undefined){
            allWhereClauses.push('auth_method = ?');
            allParams.push(convertAuthMethodToMySQL(authMethod));
        }
        if(issueTimeGMTMin !== undefined){
            allWhereClauses.push('issue_time >= ?');
            allParams.push(issueTimeGMTMin);
        }
        if(issueTimeGMTMax !== undefined){
            allWhereClauses.push('issue_time <= ?');
            allParams.push(issueTimeGMTMax);
        }
        if(expireTimeGMTMin !== undefined){
            allWhereClauses.push('expire_time >= ?');
            allParams.push(expireTimeGMTMin);
        }
        if(expireTimeGMTMax !== undefined){
            allWhereClauses.push('expire_time <= ?');
            allParams.push(expireTimeGMTMax);
        }
        if(grantUserRemoteAddr !== undefined){
            allWhereClauses.push('user_remote_addr LIKE ?');
            allParams.push('%' + grantUserRemoteAddr + '%');
        }
        if(appUID !== undefined){
            allWhereClauses.push('appuid = ?');
            allParams.push(appUID);
        }
        if(clientID !== undefined){
            allWhereClauses.push('client_id = ?');
            allParams.push(clientID);
        }
        if(maskUID !== undefined){
            allWhereClauses.push('mask_uid = ?');
            allParams.push(maskUID);
        }
        if(challengeType !== undefined){
            allWhereClauses.push('challenge_type = ?');
            allParams.push(convertAuthChallengeTypeToMySQL(challengeType));
        }
        if(used !== undefined){
            allWhereClauses.push('used = ?');
            allParams.push(used ? 1 : 0);
        }
        if(scopes !== undefined){
            for(let i=0; i<scopes.length;i++){
                let scope = scopes[i];

                allWhereClauses.push('(scopes & ?) != 0');
                allParams.push(convertOAuthScopeToMySQLOAuthScope(scope));
            }
        }
        if(codeChallenge !== undefined){
            allWhereClauses.push('code_challenge = ?');
            allParams.push(codeChallenge);
        }
        deleteStatement += allWhereClauses.length >= 1 ? ' WHERE ' + allWhereClauses.join(' AND ') : '';
        if(numLimit !== undefined){
            deleteStatement += ' LIMIT ' + numLimit.toString();
        }
        if(startPosition !== undefined){
            deleteStatement += ' OFFSET ' + startPosition.toString();
        }
        await fetchMySQL(this.mysqlConnection,deleteStatement,allParams,true);
        return;
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