import { Connection } from "mysql2";
import { UserTokenCreateInfo, UserTokenFactory, UserTokenFactoryInstallInfo } from '@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/User/UserTokenFactory';
import { BackendUserSystemSetting } from "@interactiveplus/pdk2021-backendcore/dist/AbstractDataTypes/SystemSetting/BackendUserSystemSetting";
import { UserAccessToken, UserRefreshToken, UserToken } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/User/UserToken";
import { getMySQLTypeForUserUID } from "./Utils/MySQLTypeUtil";
import { convertErorToPDKStorageEngineError } from "./Utils/MySQLErrorUtil";
import { UserEntityUID } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/User/UserEntity";
import { PDKItemExpiredOrUsedError, PDKUnknownInnerError } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Error/PDKException";
import jwt, { JwtPayload } from 'jsonwebtoken';
import { generateRandomHexString } from "@interactiveplus/pdk2021-common/dist/Utilities/HEXString";

interface UserTokenPayload{
    userId: UserEntityUID,
    exp: number,
    issueTime: number,
    refreshedTime?: number,
    issueRemoteAddr?: string,
    renewRemoteAddr?: string
}

export type {UserTokenPayload};

class UserTokenFactoryMySQL implements UserTokenFactory{
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
    verifyUserAccessToken(accessToken: UserAccessToken, userId: UserEntityUID): Promise<boolean> {
        return new Promise<boolean>((resolve, reject)=>{
            jwt.verify(accessToken,this.publicKey,{clockTimestamp: Math.round(new Date().getTime() / 1000)},(err,decoded)=>{
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
                    resolve((decoded as JwtPayload & UserTokenPayload).userId === userId);
                }
            })
        });
    }
    verifyUserRefreshToken(refreshToken: UserRefreshToken, userId: UserEntityUID): Promise<boolean> {
        let currentTimeSecGMT = Math.round(Date.now() / 1000);
        let selectStatement = "SELECT count(*) as count FROM user_tokens WHERE refresh_token = ? AND uid = ? AND valid = 1 AND refresh_expire_time > ?;"
        return new Promise<boolean>((resolve,reject) => {
            this.mysqlConnection.execute(selectStatement,[refreshToken, userId, currentTimeSecGMT],(err, result, fields)=>{
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
    verifyAndUseUserRefreshToken(refreshToken: UserRefreshToken, userId: UserEntityUID): Promise<UserToken | undefined> {
        let currentTimeSecGMT = Math.round(Date.now() / 1000);
        let updateStatement = 
        `UPDATE user_tokens SET 
        valid = 0 
        WHERE refresh_token = ? AND uid = ? AND valid = 1 AND refresh_expire_time > ?;`;
        return new Promise<UserToken | undefined>((resolve,reject) => {
            this.mysqlConnection.execute(updateStatement,[refreshToken, userId, currentTimeSecGMT],(err, result, fields)=>{
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }else if(!('affectedRows' in result)){
                    reject(new PDKUnknownInnerError("Unexpected data type received while fetching data from UserToken System"));
                }else{
                    if(result.affectedRows >= 1){
                        let createUserToken : UserTokenCreateInfo = {
                            userId: userId,
                            issueTimeGMT: currentTimeSecGMT,
                            refreshedTimeGMT: currentTimeSecGMT,
                            expireTimeGMT: currentTimeSecGMT + this.backendUserSystemSetting.userTokenAvailableDuration.accessToken,
                            refreshExpireTimeGMT: currentTimeSecGMT + this.backendUserSystemSetting.userTokenAvailableDuration.refreshToken,
                            valid: true
                        };
                        this.createUserToken(createUserToken).then((token)=>{
                            resolve(token);
                        }).catch((err)=>{
                            reject(err);
                        });
                    }else{
                        resolve(undefined);
                    }
                }
            })
        })
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