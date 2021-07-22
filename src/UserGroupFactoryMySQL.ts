import { Connection } from "mysql2";
import { BackendUserSystemSetting } from "../../PDK2021-BackendCore/dist/AbstractDataTypes/SystemSetting/BackendUserSystemSetting";
import { UserGroupFactory, UserGroupFactoryInstallInfo } from "../../PDK2021-BackendCore/dist/AbstractFactoryTypes/UserGroup/UserGroupFactory";
import { UserGroup } from "../../pdk2021-common/dist/AbstractDataTypes/UserGroup/UserGroup";
import { SearchResult } from "../../pdk2021-common/dist/InternalDataTypes/SearchResult";
import { convertErorToPDKStorageEngineError } from "./Utils/MySQLErrorUtil";
import { getMySQLTypeForAvatarSalt, getMySQLTypeForUserGroupID } from "./Utils/MySQLTypeUtil";

class UserGroupFactoryMySQL implements UserGroupFactory{
    constructor(public mysqlConnection : Connection, protected backendUserSystemSetting : BackendUserSystemSetting){

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
        throw new Error("Method not implemented.");
    }
    getUserGroup(groupId: string): Promise<UserGroup | undefined> {
        throw new Error("Method not implemented.");
    }
    checkUserGroupIDExist(groupId: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    updateUserGroup(groupId: string, groupEntity: UserGroup, oldGroupEntity?: UserGroup): Promise<void> {
        throw new Error("Method not implemented.");
    }
    deleteUserGroup(groupId: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getUserGroupCount(groupId?: string, nickname?: string, description?: string, avatarSalt?: string): Promise<number> {
        throw new Error("Method not implemented.");
    }
    searchUserGroup(groupId?: string, nickname?: string, description?: string, avatarSalt?: string, numLimit?: number, startPosition?: number): Promise<SearchResult<UserGroup>> {
        throw new Error("Method not implemented.");
    }
    clearUserGroup(groupId?: string, nickname?: string, description?: string, avatarSalt?: string, numLimit?: number, startPosition?: number): Promise<void> {
        throw new Error("Method not implemented.");
    }
    install(params: UserGroupFactoryInstallInfo): Promise<void> {
        let createTableStatement = 
        `CREATE TABLE user_groups
        (
            group_id ${getMySQLTypeForUserGroupID(this)} NOT NULL,
            nickname VARCHAR(${this.getUserGroupNickNameMaxLen()}),
            description VARCHAR(${this.getUserGroupDescriptionMaxLen()}),
            permisisons JSON NOT NULL,
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