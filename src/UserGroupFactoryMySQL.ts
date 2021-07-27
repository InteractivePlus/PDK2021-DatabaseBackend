import { Connection } from "mysql2";
import { BackendUserSystemSetting } from "@interactiveplus/pdk2021-backendcore/dist/AbstractDataTypes/SystemSetting/BackendUserSystemSetting";
import { UserGroupFactory, UserGroupFactoryInstallInfo } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/UserGroup/UserGroupFactory";
import { UserGroup } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/UserGroup/UserGroup";
import { SearchResult } from "@interactiveplus/pdk2021-common/dist/InternalDataTypes/SearchResult";
import { convertErorToPDKStorageEngineError } from "./Utils/MySQLErrorUtil";
import { getMySQLTypeForAvatarSalt, getMySQLTypeForUserGroupID } from "./Utils/MySQLTypeUtil";
import { PDKItemNotFoundError, PDKInnerArgumentError } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Error/PDKException';
import * as PDKExceptions from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Error/PDKException';

class UserGroupFactoryMySQL implements UserGroupFactory{
    constructor(public mysqlConnection : Connection, protected backendUserSystemSetting : BackendUserSystemSetting){
    }

    public static parseUserGroupEntityFromDB(dbObject : any) : UserGroup{
        if ("group_id" in dbObject && 
            "nickname" in dbObject && 
            "description" in dbObject &&
            "permissions" in dbObject &&
            "settings" in dbObject &&
            "avatar_salt" in dbObject) 
        { 
            let returnedUserGroup : UserGroup = {
                groupId : dbObject.group_id, 
                nickname : dbObject.nickname,
                description : dbObject.description,
                permissions: dbObject.permissions,
                settings : dbObject.settings,
                avatarSalt : dbObject.avatar_salt
            }
            return returnedUserGroup;
        }else{
            throw new PDKInnerArgumentError<'dbObject'>(['dbObject'], 'Unexpected Incomplete UserGroup received from DB');
        }
    }

    getUserGroupIDMaxLen(): number {
        return this.backendUserSystemSetting.userGroupFormatSetting.groupIdMaxLen !== undefined ? this.backendUserSystemSetting.userGroupFormatSetting.groupIdMaxLen : 30;
    }

    getUserGroupNickNameMaxLen() : number{
        return this.backendUserSystemSetting.userGroupFormatSetting.nicknameMaxLen !== undefined ? this.backendUserSystemSetting.userGroupFormatSetting.nicknameMaxLen : 30;
    }

    getUserGroupDescriptionMaxLen() : number{
        return this.backendUserSystemSetting.userGroupFormatSetting.descriptionMaxLen !== undefined ? this.backendUserSystemSetting.userGroupFormatSetting.descriptionMaxLen : 100;
    }

    getUserSystemSetting(): BackendUserSystemSetting {
        return this.backendUserSystemSetting;
    }

    createUserGroup(createInfo: UserGroup): Promise<UserGroup> {
        return new Promise<UserGroup> (
            (resolve, reject) => {
                let createStatement = 
                `INSERT into user_groups 
                (group_id, nickname, description, permissions, settings, avatar_salt)
                VALUES (?, ?, ?, ?, ?, ?);`;

                this.mysqlConnection.execute(
                    createStatement,
                    [
                        createInfo.groupId,
                        createInfo.nickname,
                        createInfo.description,
                        createInfo.permissions,
                        createInfo.settings,
                        createInfo.avatarSalt
                    ],
                    (err, result, fields) => {
                        if(err !== null){
                            reject(convertErorToPDKStorageEngineError(err));
                        }else{
                            let returnedUserGroup : UserGroup = {
                                groupId : createInfo.groupId,
                                nickname : createInfo.nickname,
                                description : createInfo.description,
                                permissions : createInfo.permissions,
                                settings : createInfo.settings,
                                avatarSalt : createInfo.avatarSalt
                            }
                            resolve(returnedUserGroup);
                        }
                    }
                )
            }
        )
    }

    getUserGroup(groupId: string): Promise<UserGroup | undefined> {
        return new Promise<UserGroup | undefined> (
            (resolve, reject) => {
                let selectStatement = ` SELECT * FROM user_groups WHERE group_id = ?;`;
                this.mysqlConnection.execute(
                    selectStatement,
                    [groupId],
                    (err, result, fields) => {
                        if (err !== null) {
                            reject(convertErorToPDKStorageEngineError(err));
                        } else {
                            if ("length" in result) {
                                if (result.length === 0) {
                                    resolve(undefined);
                                } else {
                                    let firstRow = result[0];
                                    if (
                                        "group_id" in firstRow &&
                                        "nickname" in firstRow &&
                                        "description" in firstRow &&
                                        "permissions" in firstRow &&
                                        "settings" in firstRow &&
                                        "avatar_salt" in firstRow
                                    ) {
                                        let returnedUserGroup : UserGroup = {
                                            groupId : firstRow.groupId,
                                            nickname : firstRow.nickname,
                                            description : firstRow.description,
                                            permissions : firstRow.permissions,
                                            settings : firstRow.settings,
                                            avatarSalt : firstRow.avatarSalt
                                        }
                                        resolve(returnedUserGroup);
                                    } else {
                                        reject(new PDKExceptions.PDKUnknownInnerError('Unexpected datatype received when fetching MYSQL data from user group System'));
                                    }
                                }
                            } else {
                                reject(new PDKExceptions.PDKUnknownInnerError('Unexpected datatype received when fetching MYSQL data from user group System'));
                            }
                        }
                    }
                )
            }
        )
    }

    checkUserGroupIDExist(groupId: string): Promise<boolean> {
        return new Promise<boolean>(
            (resolve, reject) => {
                let selectStatement = `SELECT count(*) as count from user_groups WHERE group_id = ? LIMIT 1;`;
                this.mysqlConnection.execute(
                    selectStatement,
                    [groupId],
                    (err, result, fields) => {
                        if(err !== null){
                            reject(convertErorToPDKStorageEngineError(err));
                        } else {
                            if ("length" in result && result.length !==0 && "count" in result[0]){
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

    updateUserGroup(groupId: string, groupEntity: UserGroup, oldGroupEntity?: UserGroup): Promise<void> {
        return new Promise<void>(
            (resolve, reject) => {
                let updateStatement = `UPDATE user_groups SET
                nickname = ?
                descriptoin = ?,
                permissions = ?,
                settings = ?,
                avatar_salt = ?
                WHERE group_id = ?;`;
                this.mysqlConnection.execute(
                    updateStatement,
                    [
                        groupEntity.nickname,
                        groupEntity.description,
                        groupEntity.permissions,
                        groupEntity.settings,
                        groupEntity.avatarSalt,
                        groupId
                    ],
                    (err, result, fields) => {
                        if (err !== null) {
                            reject(convertErorToPDKStorageEngineError(err));
                        } else {
                            if ("affectedRows" in result && result.affectedRows === 0){
                                reject(new PDKExceptions.PDKItemNotFoundError<'group_id'>(['group_id']));
                            } else {
                                resolve()
                            }
                        }
                    }
                )
            }
        )
    }

    deleteUserGroup(groupId: string): Promise<void> {
        return new Promise<void> (
            (resolve, reject) => {
                let deleteStatement = `DELETE FROM user_groups WHERE group_id = ?;`;
                this.mysqlConnection.execute(
                    deleteStatement,
                    [groupId],
                    (err, result, fields) => {
                        if (err !== null) {
                            reject(err);
                        } else {
                            if ("affectedRows" in result && result.affectedRows === 0 ) {
                                reject(new PDKItemNotFoundError<'group_id'>(['group_id']));
                            } else {
                                resolve();
                            }
                        }
                    }
                )
            }
        )
    }

    getUserGroupCount(groupId?: string, nickname?: string, description?: string, avatarSalt?: string): Promise<number> {
        return new Promise<number>(
            (resolve, reject) => {
                let selectStatement = `SELECT count(*) as count from user_groups`;
                let allParams : any[] = [];
                let allWHERESubClause : string[] = [];

                if (groupId !== undefined) {
                    allWHERESubClause.push('group_id = ?');
                    allParams.push(groupId);
                }
                if (groupId !== undefined) {
                    allWHERESubClause.push('nickname = ?');
                    allParams.push(nickname);
                }
                if (groupId !== undefined) {
                    allWHERESubClause.push('description = ?');
                    allParams.push(description);
                }
                if (groupId !== undefined) {
                    allWHERESubClause.push('avatar_salt = ?');
                    allParams.push(avatarSalt);
                }

                selectStatement += allWHERESubClause.length > 1 ? ' WHERE ' + allWHERESubClause.join(' AND ') : '';

                this.mysqlConnection.execute(
                    selectStatement,
                    allParams,
                    (err, result, fields) => {
                        if (err !== null) {
                            reject(convertErorToPDKStorageEngineError(err));
                        } else {
                            if('length' in result && result.length !== 0 && 'count' in result[0]){
                                resolve(
                                    result[0].count
                                )
                            }
                        }
                    }
                )
            }
        )
    }

    searchUserGroup(groupId?: string, nickname?: string, description?: string, avatarSalt?: string, numLimit?: number, startPosition?: number): Promise<SearchResult<UserGroup>> {
        return new Promise<SearchResult<UserGroup>>(
            (resolve, reject) => {
                let selectStatement = `SELECT count(*) as count from user_groups`;
                let allParams : any[] = [];
                let allWHERESubClause : string[] = [];

                if (groupId !== undefined) {
                    allWHERESubClause.push('group_id = ?');
                    allParams.push(groupId);
                }
                if (groupId !== undefined) {
                    allWHERESubClause.push('nickname = ?');
                    allParams.push(nickname);
                }
                if (groupId !== undefined) {
                    allWHERESubClause.push('description = ?');
                    allParams.push(description);
                }
                if (groupId !== undefined) {
                    allWHERESubClause.push('avatar_salt = ?');
                    allParams.push(avatarSalt);
                }

                selectStatement += allWHERESubClause.length > 1 ? ' WHERE ' + allWHERESubClause.join(' AND ') : '';

                if(numLimit !== undefined){
                    selectStatement += ' LIMIT ' + numLimit;
                }
                if(startPosition !== undefined){
                    selectStatement += ' OFFSET ' + startPosition;
                }

                this.mysqlConnection.execute(selectStatement, allParams, 
                    (err, result, fields) => {
                        if (err !== null) {
                            reject(convertErorToPDKStorageEngineError(err));
                        } else {
                            if('length' in result && result.length !== 0 && 'count' in result[0]){
                                let parsedEntities : UserGroup[] = [];
                                result.forEach((value) => {
                                    parsedEntities.push(UserGroupFactoryMySQL.parseUserGroupEntityFromDB(value));
                                });
                                resolve(new SearchResult<UserGroup>(
                                    parsedEntities.length,
                                    parsedEntities
                                ));
                            }
                        }
                    }
                );
            }
        )
    }

    clearUserGroup(groupId?: string, nickname?: string, description?: string, avatarSalt?: string, numLimit?: number, startPosition?: number): Promise<void> {
        return new Promise<void>(
            (resolve, reject) => {
                let deleteStatement = `DELETE from user_groups`;
                let allParams : any[] = [];
                let allWHERESubClause : string[] = [];

                if (groupId !== undefined) {
                    allWHERESubClause.push('group_id = ?');
                    allParams.push(groupId);
                }
                if (groupId !== undefined) {
                    allWHERESubClause.push('nickname = ?');
                    allParams.push(nickname);
                }
                if (groupId !== undefined) {
                    allWHERESubClause.push('description = ?');
                    allParams.push(description);
                }
                if (groupId !== undefined) {
                    allWHERESubClause.push('avatar_salt = ?');
                    allParams.push(avatarSalt);
                }

                deleteStatement += allWHERESubClause.length > 1 ? ' WHERE ' + allWHERESubClause.join(' AND ') : '';

                if(numLimit !== undefined){
                    deleteStatement += ' LIMIT ' + numLimit;
                }
                if(startPosition !== undefined){
                    deleteStatement += ' OFFSET ' + startPosition;
                }

                this.mysqlConnection.execute(
                    deleteStatement,
                    allParams,
                    (err, result, fields) => {
                        if (err !== null) {
                            reject(convertErorToPDKStorageEngineError(err));
                        } else {
                            resolve();
                        }
                    }
                )
 
            }
        )
    }

    install(params: UserGroupFactoryInstallInfo): Promise<void> {
        let createTableStatement = 
        `CREATE TABLE user_groups
        (
            group_id ${getMySQLTypeForUserGroupID(this)} NOT NULL,
            nickname VARCHAR(${this.getUserGroupNickNameMaxLen()}),
            description VARCHAR(${this.getUserGroupDescriptionMaxLen()}),
            permissions JSON NOT NULL,
            settings JSON NOT NULL,
            avatar_salt ${getMySQLTypeForAvatarSalt(params.avatarEntityFactory)},
            PRIMARY KEY (group_id)
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
        let dropCommand = `DROP TABLE user_groups;`;
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
        let clsCommand = `TRUNCATE TABLE user_groups;`;
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

export {UserGroupFactoryMySQL};
