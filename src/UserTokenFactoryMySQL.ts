import { Connection } from "mysql2";
import { UserTokenCreateInfo, UserTokenFactory, UserTokenFactoryInstallInfo } from '@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/User/UserTokenFactory';
import { BackendUserSystemSetting } from "@interactiveplus/pdk2021-backendcore/dist/AbstractDataTypes/SystemSetting/BackendUserSystemSetting";
import { UserRefreshToken, UserToken } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/User/UserToken";
import { getMySQLTypeForUserUID } from "./Utils/MySQLTypeUtil";
import { convertErorToPDKStorageEngineError } from "./Utils/MySQLErrorUtil";
import { UserEntityUID, UserEntityUIDJoiType } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/User/UserEntity";
import { PDKItemExpiredOrUsedError, PDKRequestParamFormatError, PDKUnknownInnerError } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Error/PDKException";
import { parseJoiTypeItems } from '@interactiveplus/pdk2021-common/dist/Utilities/JoiCheckFunctions';
import Joi from "joi";
import jwt, { JwtPayload } from 'jsonwebtoken';
import { generateRandomHexString } from "@interactiveplus/pdk2021-common/dist/Utilities/HEXString";


interface UserTokenFactoryMySQLAccessTokenVerifyInfo{
    user_token: string,
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

interface UserTokenPayload{
    userId: UserEntityUID,
    exp: number,
    issueTime: number,
    refreshedTime?: number,
    issueRemoteAddr?: string,
    renewRemoteAddr?: string
}

export type {UserTokenPayload};

class UserTokenFactoryMySQL implements UserTokenFactory<UserTokenFactoryMySQLAccessTokenVerifyInfo, UserTokenFactoryMySQLRefreshTokenVerifyInfo>{
    constructor(public mysqlConnection: Connection, protected backendUserSystemSetting : BackendUserSystemSetting, public publicKey : string, public privateKey : string, public signAlgorithm : 'RS256' | 'RS384' | 'RS512'){
        
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
        
        const reRollRefreshTokenFunc = async (maxCallStack?: number) : Promise<string> => {
            let generatedRefreshToken = generateRandomHexString(this.getRefreshTokenExactLen());
            let loopTime = 0;
            let thisTimeExist : boolean = true;
            while(maxCallStack === undefined || loopTime < maxCallStack){
                thisTimeExist = await this.checkUserRefreshTokenExist(generatedRefreshToken);
                if(!thisTimeExist){
                    break;
                }else{
                    generatedRefreshToken = generateRandomHexString(this.getRefreshTokenExactLen());
                }
                loopTime++;
            }
            if(thisTimeExist){
                throw new PDKUnknownInnerError('Rerolled ' + loopTime.toString() + ' times of user refresh token but none of them can be stored because there already exists same refresh token');
            }
            return generatedRefreshToken;
        }

        return new Promise<UserToken>((resolve, reject)=>{
            let tokenPayload : UserTokenPayload = {
                userId: createInfo.userId,
                issueRemoteAddr: createInfo.issueRemoteAddr,
                issueTime: createInfo.issueTimeGMT,
                exp: createInfo.expireTimeGMT,
                renewRemoteAddr: createInfo.renewRemoteAddr
            };
            let signedJWT = !createInfo.valid ? '' : jwt.sign(tokenPayload,this.privateKey,{algorithm: this.signAlgorithm});
            
            reRollRefreshTokenFunc(10).then((generatedRefreshToken) => {
                //Try to put GeneratedRefreshToken into DB
                let insertStatement = `INSERT INTO user_tokens
                (
                    uid,
                    refresh_token,
                    issue_time,
                    refresh_expire_time,
                    valid,
                    issue_ip
                ) VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                )`;
                this.mysqlConnection.execute(
                    insertStatement,
                    [
                        createInfo.userId,
                        generatedRefreshToken,
                        createInfo.issueTimeGMT,
                        createInfo.valid ? 1 : 0,
                        createInfo.issueRemoteAddr
                    ],
                    (err,result,fields)=>{
                        if(err!==null){
                            reject(convertErorToPDKStorageEngineError(err));
                        }else{
                            resolve({
                                userId: createInfo.userId,
                                accessToken: signedJWT,
                                refreshToken: generatedRefreshToken,
                                issueTimeGMT: createInfo.issueTimeGMT,
                                refreshedTimeGMT: createInfo.refreshedTimeGMT,
                                expireTimeGMT: createInfo.expireTimeGMT,
                                refreshExpireTimeGMT: createInfo.refreshExpireTimeGMT,
                                valid: createInfo.valid,
                                invalidDueToRefresh: createInfo.invalidDueToRefresh,
                                issueRemoteAddr: createInfo.issueRemoteAddr,
                                renewRemoteAddr: createInfo.renewRemoteAddr
                            })
                        }
                    }
                )
            }).catch((err)=>{
                reject(err);
            })
        })
    }
    verifyUserAccessToken(verifyInfo: UserTokenFactoryMySQLAccessTokenVerifyInfo): Promise<boolean> {
        return new Promise<boolean>((resolve, reject)=>{
            jwt.verify(verifyInfo.user_token,this.publicKey,{clockTimestamp: Math.round(new Date().getTime() / 1000)},(err,decoded)=>{
                if(err !== null){
                    if(!('name' in err)){
                        reject(new PDKUnknownInnerError('Unexpected err type received when trying to verify JWT Token in User System'));
                    }
                    switch(err.name){
                        case 'TokenExpiredError':
                            reject(new PDKItemExpiredOrUsedError(['user_access_token']));
                            break;
                        default:
                            resolve(false);
                            break;
                    }
                }else{
                    //check remote addr or do anything here
                    resolve((decoded as JwtPayload & UserTokenPayload).userId === verifyInfo.uid);
                }
            })
        });
    }
    async checkVerifyAccessTokenInfoValid(verifyInfo: any): Promise<UserTokenFactoryMySQLAccessTokenVerifyInfo> {
        let parsedItem = parseJoiTypeItems<UserTokenFactoryMySQLAccessTokenVerifyInfo>(verifyInfo,UserTokenFactoryMySQLAccessTokenVerifyInfoJoiType);
        if(parsedItem === undefined){
            throw new PDKRequestParamFormatError(['user_access_token']);
        }
        return parsedItem;
    }
    verifyUserRefreshToken(verifyInfo: UserTokenFactoryMySQLRefreshTokenVerifyInfo): Promise<boolean> {
        let currentTimeSecGMT = Math.round(Date.now() / 1000);
        let selectStatement = "SELECT count(*) as count FROM user_tokens WHERE refresh_token = ? AND uid = ? AND valid = 1 AND refresh_expire_time > ?;"
        return new Promise<boolean>((resolve,reject) => {
            this.mysqlConnection.execute(selectStatement,[verifyInfo.user_refresh_token, verifyInfo.uid, currentTimeSecGMT],(err, result, fields)=>{
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }else if(!('length' in result) || !('count' in result[0])){
                    reject(new PDKUnknownInnerError("Unexpected data type received while fetching data from UserToken System"));
                }else{
                    resolve(result[0].count >= 1);
                }
            })
        })
    }
    verifyAndUseUserRefreshToken(verifyInfo: UserTokenFactoryMySQLRefreshTokenVerifyInfo): Promise<boolean> {
        let currentTimeSecGMT = Math.round(Date.now() / 1000);
        let updateStatement = 
        `UPDATE user_tokens SET 
        SET valid = 0 
        WHERE refresh_token = ? AND uid = ? AND valid = 1 AND refresh_expire_time > ?;`;
        return new Promise<boolean>((resolve,reject) => {
            this.mysqlConnection.execute(updateStatement,[verifyInfo.user_refresh_token, verifyInfo.uid, currentTimeSecGMT],(err, result, fields)=>{
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }else if(!('affectedRows' in result)){
                    reject(new PDKUnknownInnerError("Unexpected data type received while fetching data from UserToken System"));
                }else{
                    resolve(result.affectedRows >= 1);
                }
            })
        })
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
            valid TINYINT(1) NOT NULL,
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