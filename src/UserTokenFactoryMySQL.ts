import { Connection } from "mysql2";
import { UserTokenCreateInfo, UserTokenFactory, UserTokenFactoryInstallInfo } from '@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/User/UserTokenFactory';
import { BackendUserSystemSetting } from "../../PDK2021-BackendCore/dist/AbstractDataTypes/SystemSetting/BackendUserSystemSetting";
import { UserAccessToken, UserRefreshToken, UserToken } from "../../pdk2021-common/dist/AbstractDataTypes/User/UserToken";
import { getMySQLTypeForUserUID } from "./Utils/MySQLTypeUtil";
import { convertErorToPDKStorageEngineError } from "./Utils/MySQLErrorUtil";
import { UserEntityUID, UserEntityUIDJoiType } from "../../pdk2021-common/dist/AbstractDataTypes/User/UserEntity";
import { PDKRequestParamFormatError, PDKUnknownInnerError } from "../../pdk2021-common/dist/AbstractDataTypes/Error/PDKException";
import { parseJoiTypeItems } from '@interactiveplus/pdk2021-common/dist/Utilities/JoiCheckFunctions';
import Joi from "joi";
import rs from 'jsrsasign';


interface UserTokenFactoryMySQLAccessTokenVerifyInfo{
    user_token: UserAccessToken,
    uid: UserEntityUID
}

const UserTokenFactoryMySQLAccessTokenVerifyInfoJoiType = Joi.object({
    user_token: Joi.string().required(),
    uid: UserEntityUIDJoiType.required()
});

export type {UserTokenFactoryMySQLAccessTokenVerifyInfo};
export {UserTokenFactoryMySQLAccessTokenVerifyInfoJoiType};

interface UserTokenFactoryMySQLRefreshTokenVerifyInfo{
    user_refresh_token: UserRefreshToken,
    uid: UserEntityUID
}

const UserTokenFactoryMySQLRefreshTokenVerifyInfoJoiType = Joi.object({
    user_refresh_token: Joi.string().required(),
    uid: UserEntityUIDJoiType.required()
});

export type {UserTokenFactoryMySQLRefreshTokenVerifyInfo};
export {UserTokenFactoryMySQLRefreshTokenVerifyInfoJoiType};

class UserTokenFactoryMySQL implements UserTokenFactory<UserTokenFactoryMySQLAccessTokenVerifyInfo, UserTokenFactoryMySQLRefreshTokenVerifyInfo>{
    constructor(public mysqlConnection: Connection, protected backendUserSystemSetting : BackendUserSystemSetting, public publicKey : rs.RSAKey, public privateKey : rs.RSAKey){
        
    }
    getAccessTokenExactLen(): number{
        return 0;
    }
    getAccessTokenMaxLen() : number{
        return 0;
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
    async checkVerifyAccessTokenInfoValid(verifyInfo: any): Promise<UserTokenFactoryMySQLAccessTokenVerifyInfo> {
        let parsedItem = parseJoiTypeItems<UserTokenFactoryMySQLAccessTokenVerifyInfo>(verifyInfo,UserTokenFactoryMySQLAccessTokenVerifyInfoJoiType);
        if(parsedItem === undefined){
            throw new PDKRequestParamFormatError(['user_access_token']);
        }
        return parsedItem;
    }
    verifyUserRefreshToken(verifyInfo: UserTokenFactoryMySQLRefreshTokenVerifyInfo): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    verifyAndUseUserRefreshToken(verifyInfo: UserTokenFactoryMySQLRefreshTokenVerifyInfo): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    async checkVerifyRefreshTokenInfoValid(verifyInfo: any): Promise<UserTokenFactoryMySQLRefreshTokenVerifyInfo> {
        let parsedItem = parseJoiTypeItems<UserTokenFactoryMySQLRefreshTokenVerifyInfo>(verifyInfo,UserTokenFactoryMySQLRefreshTokenVerifyInfoJoiType);
        if(parsedItem === undefined){
            throw new PDKRequestParamFormatError(['user_refresh_token']);
        }
        return parsedItem;
    }
    checkUserRefreshTokenExist(refreshToken: UserRefreshToken) : Promise<boolean>{
        return new Promise<boolean>((resolve,reject)=>{
            let checkExistStatement = `SELECT count(*) as count FROM user_tokens WHERE refresh_token = ?;`;
            this.mysqlConnection.execute(checkExistStatement,[refreshToken],(err,result,fields)=>{
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }else if(!('length' in result) || !('count' in result[0])){
                    reject(new PDKUnknownInnerError("Unexpected data type received while fetching data from UserToken System"));
                }else{
                    resolve(result[0].count >= 1)
                }
            })
        })
    }

    install(params: UserTokenFactoryInstallInfo): Promise<void> {
        let createTableStatement = 
        `CREATE TABLE user_tokens
        (
            uid ${getMySQLTypeForUserUID(params.userEntityFactory)} NOT NULL,
            refresh_token CHAR(${this.getRefreshTokenExactLen()}) NOT NULL,
            issue_time INT UNSIGNED NOT NULL,
            refresh_expire_time INT UNSIGNED NOT NULL,
            valid_state TINYINT(1) NOT NULL,
            issue_ip VARCHAR(45), 
            PRIMARY KEY (refresh_token)
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