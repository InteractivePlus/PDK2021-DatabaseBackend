import {Connection} from 'mysql2';
import { OAuthTokenCreateInfo, OAuthTokenFactory, OAuthTokenFactoryInstallInfo } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/OAuth/Token/OAuthTokenFactory";
import { MaskUID } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/MaskID/MaskIDEntity";
import { OAuthAccessToken, OAuthRefreshToken, OAuthToken } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/OAuth/Token/OAuthToken";
import { APPClientID, APPUID } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/RegisteredAPP/APPEntityFormat";
import { OAuthSystemSetting } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/SystemSetting/OAuthSystemSetting";
import { UserEntityUID } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/User/UserEntity";
import { SearchResult } from "@interactiveplus/pdk2021-common/dist/InternalDataTypes/SearchResult";
import { getMySQLTypeFor, getMySQLTypeForAPPClientID, getMySQLTypeForAPPEntityUID, getMySQLTypeForMaskIDUID, getMySQLTypeForOAuthToken, getMySQLTypeForUserUID } from './Utils/MySQLTypeUtil';
import { convertErorToPDKStorageEngineError } from './Utils/MySQLErrorUtil';

interface OAuthTokenFactoryMySQLAccessTokenVerifyInfo{
    access_token: string
}

interface OAuthTokenFactoryMySQLRefreshTokenVerifyInfo{
    refresh_token: string
}

export type {OAuthTokenFactoryMySQLAccessTokenVerifyInfo, OAuthTokenFactoryMySQLRefreshTokenVerifyInfo};

class OAuthTokenFactoryMySQL implements OAuthTokenFactory<OAuthTokenFactoryMySQLAccessTokenVerifyInfo, OAuthTokenFactoryMySQLRefreshTokenVerifyInfo>{
    constructor(public mysqlConnection : Connection, protected oAuthSystemSetting : OAuthSystemSetting){

    }

    getAccessTokenMaxLen(): number {
        throw new Error("Method not implemented.");
    }
    getAccessTokenExactLen(): number{
        throw new Error("Method not implemented.");
    }
    getRefreshTokenMaxLen(): number {
        throw new Error("Method not implemented.");
    }
    getRefreshTokenExactLen(): number{
        throw new Error("Method not implemented.");
    }
    
    getOAuthSystemSetting(): OAuthSystemSetting {
        return this.oAuthSystemSetting;
    }
    
    createOAuthToken(createInfo: OAuthTokenCreateInfo): Promise<OAuthToken> {
        throw new Error("Method not implemented.");
    }
    verifyOAuthAccessToken(verifyInfo: OAuthTokenFactoryMySQLAccessTokenVerifyInfo): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    setOAuthAcessTokenInvalid(accessToken: OAuthAccessToken): Promise<void>{
        throw new Error("Method not implemented.");
    }
    
    verifyOAuthRefreshToken(verifyInfo: OAuthTokenFactoryMySQLRefreshTokenVerifyInfo): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    verifyAndUseOAuthRefreshToken(verifyInfo: OAuthTokenFactoryMySQLRefreshTokenVerifyInfo): Promise<boolean> {
        throw new Error("Method not implemented.");
    }

    checkVerifyAccessTokenInfoValid(verifyInfo: any): Promise<OAuthTokenFactoryMySQLAccessTokenVerifyInfo> {
        throw new Error("Method not implemented.");
    }
    checkVerifyRefreshTokenInfoValid(verifyInfo: any): Promise<OAuthTokenFactoryMySQLRefreshTokenVerifyInfo> {
        throw new Error("Method not implemented.");
    }
    
    getOAuthToken(accessToken: OAuthAccessToken): Promise<OAuthToken | undefined>{
        throw new Error("Method not implemented.");
    }
    getOAuthTokenByRefreshToken(refreshToken: OAuthRefreshToken): Promise<OAuthToken | undefined>{
        throw new Error("Method not implemented.");
    }

    checkOAuthTokenExist(accessToken: OAuthAccessToken): Promise<boolean>{
        throw new Error("Method not implemented.");
    }
    checkOAuthRefreshTokenExist(refreshToken: OAuthRefreshToken): Promise<boolean>{
        throw new Error("Method not implemented.");
    }
    
    
    updateOAuthToken(accessToken: OAuthAccessToken, oAuthToken: OAuthToken, oldOAuthToken?: OAuthToken): Promise<void>{
        throw new Error("Method not implemented.");
    }
    updateOAuthTokenByRefreshToken(refreshToken: OAuthRefreshToken, oAuthToken: OAuthToken, oldOAuthToken?: OAuthToken): Promise<void>{
        throw new Error("Method not implemented.");
    }
    
    deleteOAuthToken(accessToken: OAuthAccessToken): Promise<void>{
        throw new Error("Method not implemented.");
    }
    deleteOAuthTokenByRefreshToken(refreshToken: OAuthRefreshToken): Promise<void>{
        throw new Error("Method not implemented.");
    }

    getOAuthTokenCount(maskUID?: MaskUID, userUID?: UserEntityUID, clientID?: APPClientID, appUID?: APPUID, accessToken?: OAuthAccessToken, refreshToken?: OAuthRefreshToken, issueTimeGMTMin?: number, issueTimeGMTMax?: number, refreshedTimeGMTMin?: number, refreshedTimeGMTMax?: number, expireTimeGMTMin?: number, expireTimeGMTMax?: number, refreshExpireTimeGMTMin?: number, refreshExpireTimeGMTMax?: number, valid?: boolean, invalidDueToRefresh?: boolean, useSideRemoteAddr?: string, appSideRemoteAddr?: string): Promise<number>{
        throw new Error("Method not implemented.");
    }
    searchOAuthToken(maskUID?: MaskUID, userUID?: UserEntityUID, clientID?: APPClientID, appUID?: APPUID, accessToken?: OAuthAccessToken, refreshToken?: OAuthRefreshToken, issueTimeGMTMin?: number, issueTimeGMTMax?: number, refreshedTimeGMTMin?: number, refreshedTimeGMTMax?: number, expireTimeGMTMin?: number, expireTimeGMTMax?: number, refreshExpireTimeGMTMin?: number, refreshExpireTimeGMTMax?: number, valid?: boolean, invalidDueToRefresh?: boolean, useSideRemoteAddr?: string, appSideRemoteAddr?: string, numLimit?: number, startPosition?: number): Promise<SearchResult<OAuthToken>>{
        throw new Error("Method not implemented.");
    }
    clearOAuthToken(maskUID?: MaskUID, userUID?: UserEntityUID, clientID?: APPClientID, appUID?: APPUID, accessToken?: OAuthAccessToken, refreshToken?: OAuthRefreshToken, issueTimeGMTMin?: number, issueTimeGMTMax?: number, refreshedTimeGMTMin?: number, refreshedTimeGMTMax?: number, expireTimeGMTMin?: number, expireTimeGMTMax?: number, refreshExpireTimeGMTMin?: number, refreshExpireTimeGMTMax?: number, valid?: boolean, invalidDueToRefresh?: boolean, useSideRemoteAddr?: string, appSideRemoteAddr?: string, numLimit?: number, startPosition?: number): Promise<void>{
        throw new Error("Method not implemented.");
    }

    install(params: OAuthTokenFactoryInstallInfo): Promise<void> {
        let typeForRefreshToken = getMySQLTypeFor(false,this.getAccessTokenMaxLen(),this.getAccessTokenExactLen());
        let createTableStatement = 
`CREATE TABLE oauth_tokens
(
    mask_uid ${getMySQLTypeForMaskIDUID(params.maskIDEntityFactory)} NOT NULL,
    user_uid ${getMySQLTypeForUserUID(params.userEntityFactory)},
    client_id ${getMySQLTypeForAPPClientID(params.appEntityFactory)} NOT NULL,
    app_uid ${getMySQLTypeForAPPEntityUID(params.appEntityFactory)},
    access_token ${getMySQLTypeForOAuthToken(this)} NOT NULL,
    refresh_token ${typeForRefreshToken} NOT NULL,
    issue_time INT UNSIGNED NOT NULL,
    refreshed_time INT UNSIGNED NOT NULL,
    expire_time INT UNSIGNED NOT NULL,
    refresh_expire_time INT UNSIGNED NOT NULL,
    valid TINYINT NOT NULL,
    user_remote_addr VARCHAR(45),
    app_remote_addr VARCHAR(45),
    PRIMARY KEY (access_token, refresh_token)
);`
        return new Promise<void>((resolve,reject) => {
            this.mysqlConnection.query(createTableStatement,(err, result, fields)=>{
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }else{
                    resolve();
                }
            })
        })
    }
    uninstall(): Promise<void>{
        let dropCommand = `DROP TABLE oauth_tokens;`;
        return new Promise((resolve, reject) =>{
            this.mysqlConnection.query(
                dropCommand,
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
        let clsCommand = `TRUNCATE TABLE oauth_tokens;`;
        return new Promise((resolve, reject) =>{
            this.mysqlConnection.query(
                clsCommand,
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

export {OAuthTokenFactoryMySQL};