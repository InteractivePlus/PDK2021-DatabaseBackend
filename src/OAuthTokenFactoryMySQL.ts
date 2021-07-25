import {Connection} from 'mysql2';
import { OAuthTokenCreateInfo, OAuthTokenFactory, OAuthTokenFactoryInstallInfo } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/OAuth/Token/OAuthTokenFactory";
import { MaskUID } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/MaskID/MaskIDEntity";
import { OAuthAccessToken, OAuthRefreshToken, OAuthToken } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/OAuth/Token/OAuthToken";
import { APPClientID } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/RegisteredAPP/APPEntityFormat";
import { OAuthSystemSetting } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/SystemSetting/OAuthSystemSetting";
import { getMySQLTypeFor, getMySQLTypeForAPPClientID, getMySQLTypeForMaskIDUID } from './Utils/MySQLTypeUtil';
import { convertErorToPDKStorageEngineError } from './Utils/MySQLErrorUtil';
import { PDKItemExpiredOrUsedError, PDKPermissionDeniedError, PDKUnknownInnerError } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Error/PDKException';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { OAuthScope } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/OAuth/OAuthScope';
import { generateRandomHexString } from '@interactiveplus/pdk2021-common/dist/Utilities/HEXString';

interface OAuthTokenPayload{
    maskId: MaskUID,
    clientId: APPClientID,
    exp: number,
    issueTime: number,
    refreshedTime?: number,
    userRemoteAddr?: string,
    scopes: OAuthScope[]
}

export type {OAuthTokenPayload};

enum OAuthScopeMySQLConv{
    basic_info = 1,
    storage = 2
}

interface OAuthTokenMySQLRefreshTokenFetchResult{
    mask_uid: MaskUID,
    client_id: APPClientID,
    refresh_token: OAuthRefreshToken,
    issue_time: number,
    refresh_expire_time: number,
    valid: number,
    user_remote_addr?: string,
    app_remote_addr?: string,
    scopes: number
}

function convertMySQLOAuthScopesToOAuthScopes(dbVal : number) : OAuthScope[]{
    let returnArr : OAuthScope[] = [];
    if((dbVal & OAuthScopeMySQLConv.basic_info) === 1){
        returnArr.push('basic_info');
    }
    if((dbVal & OAuthScopeMySQLConv.storage) === 1){
        returnArr.push('storage');
    }
    return returnArr;
}

function convertOAuthScopesToMySQLOAuthScopes(scopes : OAuthScope[]) : number{
    let returnVal = 0;
    scopes.forEach((value) => {
        if(value === 'basic_info'){
            returnVal |= OAuthScopeMySQLConv.basic_info;
        }else if(value === 'storage'){
            returnVal |= OAuthScopeMySQLConv.storage;
        }
    })
    return returnVal;
}

class OAuthTokenFactoryMySQL implements OAuthTokenFactory{
    constructor(public mysqlConnection : Connection, protected oAuthSystemSetting : OAuthSystemSetting, public publicKey : string, public privateKey : string, public signAlgorithm : 'RS256' | 'RS384' | 'RS512'){

    }

    getAccessTokenMaxLen(): number {
        return 0;
    }
    getAccessTokenExactLen(): number{
        return 0;
    }
    getRefreshTokenMaxLen(): number {
        return this.getRefreshTokenExactLen();
    }
    getRefreshTokenExactLen(): number{
        return this.oAuthSystemSetting.oAuthTokenFormat.refreshTokenCharNum !== undefined ? this.oAuthSystemSetting.oAuthTokenFormat.refreshTokenCharNum : 24;
    }
    
    getOAuthSystemSetting(): OAuthSystemSetting {
        return this.oAuthSystemSetting;
    }
    
    createOAuthToken(createInfo: OAuthTokenCreateInfo): Promise<OAuthToken> {
        const reRollRefreshToken = async (maxCallStack?: number) : Promise<OAuthRefreshToken> => {
            let rolledToken = generateRandomHexString(this.getRefreshTokenExactLen());
            let loopTime = 0;

            while(maxCallStack === undefined || loopTime < maxCallStack){
                if(!(await this.checkOAuthRefreshTokenExist(rolledToken))){
                    return rolledToken;
                }else{
                    rolledToken = generateRandomHexString(this.getRefreshTokenExactLen());
                }
                loopTime++;
            }
            throw new PDKUnknownInnerError('Rerolled ' + loopTime.toString() + ' times of oauth refresh token but none of them can be stored because there already exists same refresh token')
        }
        return new Promise<OAuthToken>((resolve,reject) => {
            reRollRefreshToken(10).then((refreshToken)=>{
                let createStatement = 
                `INSERT INTO oauth_tokens 
                (
                    mask_uid,
                    client_id,
                    refresh_token,
                    issue_time,
                    refresh_expire_time,
                    valid,
                    user_remote_addr,
                    app_remote_addr,
                    scopes
                ) VALUES (
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
                this.mysqlConnection.execute(
                    createStatement,
                    [
                        createInfo.maskUID,
                        createInfo.clientID,
                        refreshToken,
                        createInfo.issueTimeGMT,
                        createInfo.refreshExpireTimeGMT,
                        createInfo.valid ? 1 : 0,
                        createInfo.userSideRemoteAddr,
                        createInfo.appSideRemoteAddr,
                        convertOAuthScopesToMySQLOAuthScopes(createInfo.scopes)
                    ],
                    (err,result,fields) => {
                        if(err !== null){
                            reject(convertErorToPDKStorageEngineError(err));
                        }else{
                            let tokenPayload : OAuthTokenPayload = {
                                maskId: createInfo.maskUID,
                                clientId: createInfo.clientID,
                                exp: createInfo.expireTimeGMT,
                                issueTime: createInfo.issueTimeGMT,
                                refreshedTime: createInfo.refreshedTimeGMT,
                                userRemoteAddr: createInfo.userSideRemoteAddr,
                                scopes: createInfo.scopes
                            };
                            let signedJWT = !createInfo.valid ? '' : jwt.sign(tokenPayload,this.privateKey,{algorithm: this.signAlgorithm});
                            resolve({
                                maskUID: createInfo.maskUID,
                                userUID: createInfo.userUID,
                                clientID: createInfo.clientID,
                                appUID: createInfo.appUID,
                                accessToken: signedJWT,
                                refreshToken: refreshToken,
                                issueTimeGMT: createInfo.issueTimeGMT,
                                refreshedTimeGMT: createInfo.refreshedTimeGMT,
                                expireTimeGMT: createInfo.expireTimeGMT,
                                refreshExpireTimeGMT: createInfo.refreshExpireTimeGMT,
                                valid: createInfo.valid,
                                invalidDueToRefresh: createInfo.invalidDueToRefresh,
                                userSideRemoteAddr: createInfo.userSideRemoteAddr,
                                appSideRemoteAddr: createInfo.appSideRemoteAddr,
                                scopes: createInfo.scopes
                            });
                        }
                    }
                );
            }).catch((err)=>{
                reject(err);
            });
        });
    }
    verifyOAuthAccessToken(accessToken: OAuthAccessToken, maskUID?: MaskUID, clientID?: APPClientID, requiredScopes?: OAuthScope[]): Promise<boolean> {
        return new Promise<boolean>((resolve, reject)=>{
            jwt.verify(accessToken,this.publicKey,{clockTimestamp: Math.round(new Date().getTime() / 1000)},(err,decoded)=>{
                if(err !== null){
                    if(!('name' in err)){
                        reject(new PDKUnknownInnerError('Unexpected err type received when trying to verify JWT Token in OAuthToken System'));
                    }
                    switch(err.name){
                        case 'TokenExpiredError':
                            reject(new PDKItemExpiredOrUsedError(['oauth_access_token']));
                            return;
                        default:
                            resolve(false);
                            return;
                    }
                }else{
                    //check remote addr or do anything here
                    let decodedTokenPayload : JwtPayload & OAuthTokenPayload = decoded as JwtPayload & OAuthTokenPayload;
                    if(maskUID !== undefined && decodedTokenPayload.maskId !== maskUID){
                        resolve(false);
                        return;
                    }
                    if(clientID !== undefined && decodedTokenPayload.clientId !== clientID){
                        resolve(false);
                        return;
                    }
                    if(requiredScopes !== undefined){
                        for(let i=0; i<requiredScopes.length; i++){
                            if(!decodedTokenPayload.scopes.includes(requiredScopes[i])){
                                reject(new PDKPermissionDeniedError(['scopes'],'You do not have required scopes to perform this action'));
                                return;
                            }
                        }
                    }
                    resolve(true);
                    return;
                }
            })
        });
    }
    verifyOAuthRefreshToken(refreshToken: OAuthAccessToken, maskUID?: MaskUID, clientID?: APPClientID): Promise<boolean> {
        return new Promise<boolean>((resolve,reject) => {
            let currentTimeSecGMT = Math.round(Date.now() / 1000);
            let selectStatement = "SELECT count(*) as count FROM oauth_tokens WHERE ";
            let allParams : any[] = [];

            selectStatement += "refresh_token = ?";
            allParams.push(refreshToken);

            selectStatement += " AND refresh_expire_time > ?";
            allParams.push(currentTimeSecGMT);

            selectStatement += " AND valid = 1";

            if(maskUID !== undefined){
                selectStatement += ' AND mask_uid = ?';
                allParams.push(maskUID);
            }

            if(clientID !== undefined){
                selectStatement += ' AND client_id = ?';
                allParams.push(clientID);
            }

            selectStatement += ';';

            this.mysqlConnection.execute(selectStatement,allParams,(err, result, fields)=>{
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }else if(!('length' in result) || !('count' in result[0])){
                    reject(new PDKUnknownInnerError("Unexpected data type received while fetching data from OAuthToken System"));
                }else{
                    resolve(result[0].count >= 1);
                }
            })
        })
    }

    verifyAndUseOAuthRefreshToken(refreshToken: OAuthAccessToken, maskUID?: MaskUID, clientID?: APPClientID): Promise<OAuthToken | undefined> {
        //We need to do some dirty work here, because we need to first read the refresh token then update it
        return new Promise<OAuthToken | undefined>((resolve,reject)=>{
            let currentTimeSecGMT = Math.round(Date.now() / 1000);
            let selectStatement = "SELECT * FROM oauth_tokens WHERE";
            let selectParams : any[] = [];

            selectStatement += " refreshToken = ?";
            selectParams.push(refreshToken);

            selectStatement += " AND refresh_expire_time > ?";
            selectParams.push(currentTimeSecGMT);

            if(maskUID !== undefined){
                selectStatement += " AND mask_uid = ?";
                selectParams.push(maskUID);
            }
            if(clientID !== undefined){
                selectStatement += " AND client_id = ?";
                selectParams.push(clientID);
            }

            selectStatement += ' AND valid = 1';

            selectStatement += ' LIMIT 1';
            selectStatement += ';';

            this.mysqlConnection.execute(selectStatement,selectParams,(err,result,fields)=>{
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }
                if(!('length' in result)){
                    reject('Unexpected data type received while fetching data from OAuthToken System')
                }else if(result.length <= 0){
                    resolve(undefined);
                }
                //@ts-ignore
                let fetchedRefreshToken = result[0] as OAuthTokenMySQLRefreshTokenFetchResult;
                let updateStatement = 
                `UPDATE oauth_tokens SET 
                valid = 0
                WHERE refreshToken = ?`;
                this.mysqlConnection.execute(updateStatement,[refreshToken],(err,result,fields)=>{
                    if(err !== null){
                        reject(convertErorToPDKStorageEngineError(err));
                    }else{
                        let createInfo : OAuthTokenCreateInfo = {
                            maskUID: fetchedRefreshToken.mask_uid,
                            clientID: fetchedRefreshToken.client_id,
                            issueTimeGMT: fetchedRefreshToken.issue_time,
                            refreshedTimeGMT: currentTimeSecGMT,
                            expireTimeGMT: currentTimeSecGMT + this.oAuthSystemSetting.oAuthTokenAvailableDuration.accessToken,
                            refreshExpireTimeGMT: currentTimeSecGMT + this.oAuthSystemSetting.oAuthTokenAvailableDuration.refreshToken,
                            valid: true,
                            userSideRemoteAddr: fetchedRefreshToken.user_remote_addr,
                            appSideRemoteAddr: fetchedRefreshToken.app_remote_addr,
                            scopes: convertMySQLOAuthScopesToOAuthScopes(fetchedRefreshToken.scopes)
                        };
                        resolve(this.createOAuthToken(createInfo));
                    }
                })
            })
        })
    }

    checkOAuthRefreshTokenExist(refreshToken: OAuthRefreshToken): Promise<boolean>{
        return new Promise<boolean>((resolve, reject) => {
            let selectStatement = "SELECT count(*) as count FROM oauth_tokens WHERE refresh_token = ?;";
            this.mysqlConnection.execute(selectStatement,refreshToken,(err,result,fields) => {
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }
                if(!('length' in result) || result.length < 1 || !('count' in result[0])){
                    reject(new PDKUnknownInnerError('Unexpected data type is obtained when trying to fetch OAuth Refresh Token Info from OAuthToken System'));
                }else{
                    resolve(result[0].count >= 1);
                }
            })
        });
    }

    install(params: OAuthTokenFactoryInstallInfo): Promise<void> {
        let typeForRefreshToken = getMySQLTypeFor(false,this.getAccessTokenMaxLen(),this.getAccessTokenExactLen());
        let createTableStatement = 
`CREATE TABLE oauth_tokens
(
    mask_uid ${getMySQLTypeForMaskIDUID(params.maskIDEntityFactory)} NOT NULL,
    client_id ${getMySQLTypeForAPPClientID(params.appEntityFactory)} NOT NULL,
    refresh_token ${typeForRefreshToken} NOT NULL,
    issue_time INT UNSIGNED NOT NULL,
    refresh_expire_time INT UNSIGNED NOT NULL,
    valid TINYINT NOT NULL,
    user_remote_addr VARCHAR(45),
    app_remote_addr VARCHAR(45),
    scopes TINYINT NOT NULL,
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