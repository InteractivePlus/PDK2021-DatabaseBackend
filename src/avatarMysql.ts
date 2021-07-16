import mysql,{Connection, RowDataPacket} from 'mysql2';
import {AvatarEntityFactory, AvatarCreateEntity} from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/Avatar/AvatarEntityFactory";
import {AvatarEntity} from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Avatar/AvatarEntity";
import sha1 from 'simple-sha1';

class avatarMysql implements AvatarEntityFactory{
    constructor(public mysqlConnection:Connection) {}

    getAvatarBySalt(salt: string): Promise<AvatarEntity | undefined>{
        return new Promise<AvatarEntity | undefined>(
            (resolve, reject)=> {
                let selectStatement = 'SELECT * FROM avatars WHERE salt = ? LIMIT 1';
                this.mysqlConnection.execute(selectStatement,[salt],(err,result,fields)=>{
                    if (err !== null) {
                        reject(err);
                    } else {
                        if ("length" in result){
                            if (result.length === 0){
                                resolve(undefined)
                            } else {
                                if ("data" in result[0] && "salt" in result[0] && "uploadedBy" in result[0] && "uploadTimeGMTInSec" in result[0] ){
                                    let returnedData:AvatarEntity = {
                                        data: result[0].data,
                                        salt: result[0].salt,
                                        uploadedBy: result[0].uploadedBy,
                                        uploadTimeGMTInSec: result[0].uploadTimeGMTInSec
                                    }
                                    resolve(returnedData)
                                } else {
                                    reject("unexpected datatype")
                                }
                            }
                        } else {
                            reject("unexpected datatype")
                        }
                    }
                })
            }
        )
    }

    uploadNewAvatar(createInfo: AvatarCreateEntity): Promise<AvatarEntity>{
        let generatedHash = sha1.sync(createInfo.data.content);
        return new Promise<AvatarEntity>(
            (resolve, reject) => {
                let createStatement = 
                `INSERT INTO avatars 
                (data, salt, uploadedBy, uploadTimeGMTInSec) 
                VALUES (?, ?, ?, ?)`;
                this.mysqlConnection.execute(
                    createStatement, 
                    [
                        createInfo.data, 
                        generatedHash, 
                        createInfo.uploadedBy, 
                        createInfo.uploadTimeGMTInSec
                    ], 
                    function(err, result, fields){
                        if (err !== null) {
                            reject(err);
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
                            reject('unexpected error')
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
                data = ?, uploadedBy = ?, uploadTimeGMTInSec = ?
                WHERE salt = ?`;
                this.mysqlConnection.execute(
                    updateStatement, 
                    [
                        avatarEntity.data, 
                        avatarEntity.uploadedBy, 
                        avatarEntity.uploadTimeGMTInSec,
                        salt
                    ], 
                    function(err, result, fields){
                        if (err !== null) {
                            reject(err);
                        } else {
                            if ("affectedRows" in result && result.affectedRows === 0){
                                reject("no such salt existed")
                            } else {
                                resolve()
                            }
                        }
                    }
                )
            }
        )
    }

    createTable() {
        //SHA1
        let tableCommand = `CREATE TABLE avatars 
                            (
                                'data' JSON NOT NULL,
                                'salt' CHAR(40) NOT NULL,
                                'uploadedBy' VARCHAR(100),
                                'uploadTimeGMTInSec' INT UNSINGED,
                                PRIMARY KEY (salt)
                            );`;
        return new Promise((resolve, reject) => {
            this.mysqlConnection.query(
            tableCommand, 
            function(err, results, fields) {
                if(err !== null){
                    reject(err);
                }else{
                    resolve(undefined);
                }
            })
        });
    }
}
