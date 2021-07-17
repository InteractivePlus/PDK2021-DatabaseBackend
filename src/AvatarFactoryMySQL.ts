import {Connection} from 'mysql2';
import {AvatarEntityFactory, AvatarCreateEntity} from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/Avatar/AvatarEntityFactory";
import {AvatarEntity} from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Avatar/AvatarEntity";
import sha1 from 'simple-sha1';
import { BackendAvatarSystemSetting } from '@interactiveplus/pdk2021-backendcore/dist/AbstractDataTypes/SystemSetting/BackendAvatarSystemSetting';
import * as PDKExceptions from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Error/PDKException';
import { convertErorToPDKStorageEngineError } from './Utils/MySQLErrorUtil';


class AvatarFactoryMySQL implements AvatarEntityFactory{
    constructor(
        protected systemSetting : BackendAvatarSystemSetting,
        public mysqlConnection:Connection
    ) {}

    public static setABC(){

    }

    getAvatarSystemSetting() : BackendAvatarSystemSetting{
        return this.systemSetting;
    }

    getAvatarBySalt(salt: string): Promise<AvatarEntity | undefined>{
        return new Promise<AvatarEntity | undefined>(
            (resolve, reject)=> {
                let selectStatement = 'SELECT * FROM avatars WHERE salt = ? LIMIT 1';
                this.mysqlConnection.execute(selectStatement,[salt],(err,result,fields)=>{
                    if (err !== null) {
                        reject(convertErorToPDKStorageEngineError(err));
                    } else {
                        if ("length" in result){
                            if (result.length === 0){
                                resolve(undefined);
                            } else {
                                let firstRow = result[0];
                                if (
                                    "data_type" in firstRow &&
                                    "data_content" in firstRow &&
                                    "salt" in firstRow && 
                                    "uploaded_by" in firstRow && 
                                    "upload_time" in firstRow
                                ){
                                    let returnedData:AvatarEntity = {
                                        data: {
                                            type: AvatarFactoryMySQL.parseDataType(firstRow.data_type),
                                            content: firstRow.data_content
                                        },
                                        salt: firstRow.salt,
                                        uploadedBy: firstRow.uploaded_by,
                                        uploadTimeGMTInSec: firstRow.upload_time
                                    }
                                    if('data_content_type' in firstRow && firstRow.data_content_type !== undefined){
                                        returnedData.data.contentType = AvatarFactoryMySQL.parseContentType(firstRow.data_content_type);
                                    }
                                    resolve(returnedData);
                                } else {
                                    reject(new PDKExceptions.PDKUnknownInnerError('Unexpected datatype received when fetching MYSQL data from Avatar System'));
                                }
                            }
                        } else {
                            reject(new PDKExceptions.PDKUnknownInnerError('Unexpected datatype received when fetching MYSQL data from Avatar System'));
                        }
                    }
                });
            }
        )
    }

    uploadNewAvatar(createInfo: AvatarCreateEntity): Promise<AvatarEntity>{
        let generatedHash = sha1.sync(createInfo.data.content);
        return new Promise<AvatarEntity>(
            (resolve, reject) => {
                let createStatement = 
                `INSERT INTO avatars 
                (data_type, data_content_type, data_content, salt, uploaded_by, upload_time) 
                VALUES (?, ?, ?, ?, ?, ?)`;
                this.mysqlConnection.execute(
                    createStatement, 
                    [
                        createInfo.data.type,
                        createInfo.data.contentType,
                        createInfo.data.content, 
                        generatedHash,
                        createInfo.uploadedBy, 
                        createInfo.uploadTimeGMTInSec
                    ], 
                    function(err, result, fields){
                        if (err !== null) {
                            reject(convertErorToPDKStorageEngineError(err));
                        } else {
                            let returnedAvatarEntity:AvatarEntity={
                                data: createInfo.data, 
                                salt: generatedHash, 
                                uploadedBy: createInfo.uploadedBy, 
                                uploadTimeGMTInSec: createInfo.uploadTimeGMTInSec
                            }
                            resolve(returnedAvatarEntity)
                        }
                    }
                )
            }
        )
    }

    checkAvatarExists(salt: string): Promise<boolean>{
        return new Promise<boolean>(
            (resolve, reject) => {
                let selectStatement = 'SELECT count(*) as count FROM avatars WHERE salt = ?';
                this.mysqlConnection.execute(
                    selectStatement,
                    [salt],
                    function(err,result,field){
                        if(err !== null){
                            reject(convertErorToPDKStorageEngineError(err));
                        }else{
                            if('length' in result && result.length !== 0 && 'count' in result[0]){
                                resolve(
                                    result[0].count >= 1
                                )
                            }
                        }
                    }
                )
            }
        )
    }

    updateAvatar(salt: string, avatarEntity: AvatarEntity, oldAvatarEntity?: AvatarEntity): Promise<void>{
        return new Promise<void>(
            (resolve, reject) => {
                let updateStatement = 
                `UPDATE avatars SET 
                data_type = ?, data_content_type = ?, data_content = ?, uploaded_by = ?, upload_time = ?
                WHERE salt = ?`;
                this.mysqlConnection.execute(
                    updateStatement, 
                    [
                        avatarEntity.data.type, 
                        avatarEntity.data.contentType,
                        avatarEntity.data.content,
                        avatarEntity.uploadedBy, 
                        avatarEntity.uploadTimeGMTInSec,
                        salt
                    ], 
                    function(err, result, fields){
                        if (err !== null) {
                            reject(convertErorToPDKStorageEngineError(err));
                        } else {
                            if ("affectedRows" in result && result.affectedRows === 0){
                                reject(new PDKExceptions.PDKItemNotFoundError<'salt'>(['salt']));
                            } else {
                                resolve()
                            }
                        }
                    }
                )
            }
        )
    }

    public static parseDataType(databaseDataType : number) : 'URL' | 'base64' | 'binary'{
        switch(databaseDataType){
            case 1:
                return 'URL';
            case 2:
                return 'base64';
            case 3:
                return 'binary';
            default:
                throw new PDKExceptions.PDKInnerArgumentError<'databaseDataType'>(['databaseDataType']);
        }
    }

    public static encodeDataType(avatarDataType : 'URL' | 'base64' | 'binary') : number{
        switch(avatarDataType){
            case 'URL':
                return 1;
            case 'base64':
                return 2;
            case 'binary':
                return 3;
            default:
                throw new PDKExceptions.PDKInnerArgumentError<'avatarDataType'>(['avatarDataType'],'Unrecognized AvatarEntity.AvatarData.type');
        }
    }

    public static parseContentType(databaseContentType : number) : 'image/jpeg' | 'image/png'{
        switch(databaseContentType){
            case 1:
                return 'image/jpeg';
            case 2:
                return 'image/png';
            default:
                throw new PDKExceptions.PDKInnerArgumentError<'databaseContentType'>(['databaseContentType']);
        }
    }

    public static encodeContentType(avatarContentType : 'image/jpeg' | 'image/png') : number{
        switch(avatarContentType){
            case 'image/jpeg':
                return 1;
            case 'image/png':
                return 2;
            default:
                throw new PDKExceptions.PDKInnerArgumentError<'avatarContentType'>(['avatarContentType'],'Unrecognized AvatarEntity.AvatarData.contentType');
        }
    }

    install() : Promise<void> {
        //SHA1
        let tableCommand = `CREATE TABLE avatars 
                            (
                                'data_type' TINYINT NOT NULL,
                                'data_content_type' TINYINT,
                                'data_content' MEDIUMBLOB NOT NULL,
                                'salt' CHAR(40) NOT NULL,
                                'uploaded_by' VARCHAR(100),
                                'upload_time' INT UNSINGED,
                                PRIMARY KEY (salt)
                            );`;
        return new Promise((resolve, reject) => {
            this.mysqlConnection.query(
            tableCommand, 
            function(err, results, fields) {
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }else{
                    resolve();
                }
            })
        });
    }

    uninstall(): Promise<void>{
        let tableCommand = `DROP TABLE avatars`;
        return new Promise((resolve, reject) => {
            this.mysqlConnection.query(
            tableCommand, 
            function(err, results, fields) {
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }else{
                    resolve();
                }
            })
        });
    }

    clearData(): Promise<void>{
        let tableCommand = `TRUNCATE TABLE avatars`;
        return new Promise((resolve, reject) => {
            this.mysqlConnection.query(
            tableCommand, 
            function(err, results, fields) {
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }else{
                    resolve();
                }
            })
        });
    }
}
