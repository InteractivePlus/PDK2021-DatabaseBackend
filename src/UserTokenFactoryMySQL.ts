import { Connection } from "mysql2";
import { UserTokenCreateInfo, UserTokenFactory, UserTokenFactoryInstallInfo } from '@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/User/UserTokenFactory';
import { BackendUserSystemSetting } from "../../PDK2021-BackendCore/dist/AbstractDataTypes/SystemSetting/BackendUserSystemSetting";
import { UserEntityUID } from "../../pdk2021-common/dist/AbstractDataTypes/User/UserEntity";
import { UserAccessToken, UserRefreshToken, UserToken } from "../../pdk2021-common/dist/AbstractDataTypes/User/UserToken";
import { SearchResult } from "../../pdk2021-common/dist/InternalDataTypes/SearchResult";
import { getMySQLTypeForUserUID } from "./Utils/MySQLTypeUtil";
import { convertErorToPDKStorageEngineError } from "./Utils/MySQLErrorUtil";

interface UserTokenFactoryMySQLAccessTokenVerifyInfo{
    user_token: string
}

export type {UserTokenFactoryMySQLAccessTokenVerifyInfo};

interface UserTokenFactoryMySQLRefreshTokenVerifyInfo{
    user_refresh_token: string
}

export type {UserTokenFactoryMySQLRefreshTokenVerifyInfo};

class UserTokenFactoryMySQL implements UserTokenFactory<UserTokenFactoryMySQLAccessTokenVerifyInfo, UserTokenFactoryMySQLRefreshTokenVerifyInfo>{
    constructor(public mysqlConnection: Connection, protected backendUserSystemSetting : BackendUserSystemSetting){
        
    }
    getAccessTokenMaxLen(): number {
        return this.getAccessTokenExactLen();
    }
    getAccessTokenExactLen(): number{
        return this.backendUserSystemSetting.userTokenFormatSetting.acessTokenCharNum !== undefined ? this.backendUserSystemSetting.userTokenFormatSetting.acessTokenCharNum : 24;
    }
    getRefreshTokenMaxLen(): number {
        return this.getRefreshTokenExactLen();
    }
    getRefreshTokenExactLen(): number{
        return this.backendUserSystemSetting.userTokenFormatSetting.refreshTokenCharNum !== undefined ? this.backendUserSystemSetting.userTokenFormatSetting.refreshTokenCharNum : 24;
    }
    getUserSystemSetting(): BackendUserSystemSetting {
        return this.backendUserSystemSetting;
    }

    createUserToken(createInfo: UserTokenCreateInfo): Promise<UserToken> {
        throw new Error("Method not implemented.");
    }
    verifyUserAccessToken(verifyInfo: UserTokenFactoryMySQLAccessTokenVerifyInfo): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    setUserAccessTokenInvalid(accessToken: UserAccessToken): Promise<void>{
        throw new Error("Method not implemented.");
    }
    checkVerifyAccessTokenInfoValid(verifyInfo: any): Promise<UserTokenFactoryMySQLAccessTokenVerifyInfo> {
        throw new Error("Method not implemented.");
    }
    verifyUserRefreshToken(verifyInfo: UserTokenFactoryMySQLRefreshTokenVerifyInfo): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    verifyAndUseUserRefreshToken(verifyInfo: UserTokenFactoryMySQLRefreshTokenVerifyInfo): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    checkVerifyRefreshTokenInfoValid(verifyInfo: any): Promise<UserTokenFactoryMySQLRefreshTokenVerifyInfo> {
        throw new Error("Method not implemented.");
    }

    getUserToken(accessToken: UserAccessToken): Promise<UserToken | undefined>{
        throw new Error("Method not implemented.");
    }
    getUserTokenByRefreshToken(refreshToken: UserRefreshToken): Promise<UserToken | undefined>{
        throw new Error("Method not implemented.");
    }
    updateUserToken(accessToken: UserAccessToken, tokenEntity: UserToken, oldTokenEntity?: UserToken): Promise<void>{
        throw new Error("Method not implemented.");
    }
    updateUserTokenByRefreshToken(refreshToken: UserRefreshToken, tokenEntity: UserToken, oldTokenEntity?: UserToken): Promise<void>{
        throw new Error("Method not implemented.");
    }
    deleteUserToken(accessToken: UserAccessToken): Promise<void>{
        throw new Error("Method not implemented.");
    }
    deleteUserTokenByRefreshToken(refreshToken: UserRefreshToken): Promise<void>{
        throw new Error("Method not implemented.");
    }
    getUserTokenCount(userId?: UserEntityUID, accessToken?: UserAccessToken, refreshToken?: UserRefreshToken, issueTimeGMTMin?: number, issueTimeGMTMax?: number, refreshedTimeGMTMin?: number, refreshedTimeGMTMax?: number, expireTimeGMTMin?: number, expireTimeGMTMax?: number, refreshExpireTimeGMTMin?: number, refreshExpireTimeGMTMax?: number, valid?: boolean, invalidDueToRefresh?: boolean, issueRemoteAddr?: string, renewRemoteAddr?: string): Promise<number>{
        throw new Error("Method not implemented.");
    }

    searchUserToken(userId?: UserEntityUID, accessToken?: string, refreshToken?: string, issueTimeGMTMin?: number, issueTimeGMTMax?: number, refreshedTimeGMTMin?: number, refreshedTimeGMTMax?: number, expireTimeGMTMin?: number, expireTimeGMTMax?: number, refreshExpireTimeGMTMin?: number, refreshExpireTimeGMTMax?: number, valid?: boolean, invalidDueToRefresh?: boolean, issueRemoteAddr?: string, renewRemoteAddr?: string, numLimit?: number, startPosition?: number): Promise<SearchResult<UserToken>> {
        throw new Error("Method not implemented.");
    }
    clearUserToken(userId?: UserEntityUID, accessToken?: string, refreshToken?: string, issueTimeGMTMin?: number, issueTimeGMTMax?: number, refreshedTimeGMTMin?: number, refreshedTimeGMTMax?: number, expireTimeGMTMin?: number, expireTimeGMTMax?: number, refreshExpireTimeGMTMin?: number, refreshExpireTimeGMTMax?: number, valid?: boolean, invalidDueToRefresh?: boolean, issueRemoteAddr?: string, renewRemoteAddr?: string, numLimit?: number, startPosition?: number): Promise<void> {
        throw new Error("Method not implemented.");
    }
    install(params: UserTokenFactoryInstallInfo): Promise<void> {
        let createTableStatement = 
        `CREATE TABLE user_tokens
        (
            uid ${getMySQLTypeForUserUID(params.userEntityFactory)} NOT NULL,
            access_token CHAR(${this.getAccessTokenExactLen()}) NOT NULL,
            refresh_token CHAR(${this.getRefreshTokenExactLen()}) NOT NULL,
            issue_time INT UNSIGNED NOT NULL,
            refreshed_time INT UNSIGNED,
            expire_time INT UNSIGNED NOT NULL,
            refresh_expire_time INT UNSIGNED NOT NULL,
            valid_state TINYINT NOT NULL,
            issue_ip VARCHAR(45),
            renew_ip VARCHAR(45),
            PRIMARY KEY (access_token, refresh_token)
        );`
        //Valid => 0: invalid, 1: valid, -1: invalid due to refresh
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
        let dropCommand = `DROP TABLE user_tokens;`;
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
        let clsCommand = `TRUNCATE TABLE user_tokens;`;
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

export {UserTokenFactoryMySQL};