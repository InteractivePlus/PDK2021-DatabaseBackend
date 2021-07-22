import {Connection} from 'mysql2';
import { BackendUserSystemSetting } from '@interactiveplus/pdk2021-backendcore/dist/AbstractDataTypes/SystemSetting/BackendUserSystemSetting';
import { UserEntityCreateInfo, UserEntityFactory, UserEntityFactoryInstallInfo } from '@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/User/UserEntityFactory';
import { PhoneNumber, UserEntity, UserEntityUID } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/User/UserEntity';
import { UserGroupGroupID } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/UserGroup/UserGroup';
import { SearchResult } from '@interactiveplus/pdk2021-common/dist/InternalDataTypes/SearchResult';
import { countries } from '@interactiveplus/pdk2021-common/node_modules/i18n-codes-js/dist';
import { convertErorToPDKStorageEngineError } from './Utils/MySQLErrorUtil';
import { getMySQLTypeForAvatarSalt, getMySQLTypeForUserGroupID, getMySQLTypeForUserUID } from './Utils/MySQLTypeUtil';

class UserEntityFactoryMySQL implements UserEntityFactory{
    constructor(public mysqlConnection : Connection, protected backendUserSystemSetting : BackendUserSystemSetting){

    }
    getUserUIDMaxLen(): number {
        return 5;
    }
    getUserUIDExactLen(): number{
        return 5;
    }
    isUserUIDNumber(): boolean {
        return true;
    }
    getUsernameMaxLen() : number{
        return this.backendUserSystemSetting.userEntityFormatSetting.usernameMaxLen !== undefined ? this.backendUserSystemSetting.userEntityFormatSetting.usernameMaxLen : 20;
    }
    getNickNameMaxLen() : number{
        return this.backendUserSystemSetting.userEntityFormatSetting.nicknameMaxLen !== undefined ? this.backendUserSystemSetting.userEntityFormatSetting.nicknameMaxLen : 20;
    }
    getSignatureMaxLen() : number{
        return this.backendUserSystemSetting.userEntityFormatSetting.signatureMaxLen !== undefined ? this.backendUserSystemSetting.userEntityFormatSetting.signatureMaxLen : 100;
    }
    getPasswordHashMaxLen() : number{
        return this.backendUserSystemSetting.passwordHashMaxLen;
    }
    getEmailMaxLen() : number{
        return this.backendUserSystemSetting.userEntityFormatSetting.emailMaxLen !== undefined ? this.backendUserSystemSetting.userEntityFormatSetting.emailMaxLen : 100;
    }
    getUserSystemSetting(): BackendUserSystemSetting {
        return this.backendUserSystemSetting;
    }

    createUser(createInfo: UserEntityCreateInfo): Promise<UserEntity> {
        throw new Error('Method not implemented.');
    }
    checkUIDExist(uid: UserEntityUID): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    checkUsernameExist(username: string): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    checkEmailExist(email: string): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    checkPhoneNumExist(phoneNum: PhoneNumber): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    checkAnyIdentifierExist(username: string, email?: string, phoneNum?: PhoneNumber): Promise<('username' | 'email' | 'phoneNum')[] | undefined> {
        throw new Error('Method not implemented.');
    }
    getUser(uid: UserEntityUID): Promise<UserEntity | undefined> {
        throw new Error('Method not implemented.');
    }
    getUserByUsername(username: string): Promise<UserEntity | undefined> {
        throw new Error('Method not implemented.');
    }
    getUserByEmail(email: string): Promise<UserEntity | undefined> {
        throw new Error('Method not implemented.');
    }
    getUserByPhoneNum(phoneNum : PhoneNumber) : Promise<UserEntity | undefined>{
        throw new Error('Method not implemented.');
    }
    updateUser(uid: UserEntityUID, userEntity: UserEntity, oldUserEntity?: UserEntity): Promise<void> {
        throw new Error('Method not implemented.');
    }
    deleteUser(uid: UserEntityUID): Promise<void> {
        throw new Error('Method not implemented.');
    }

    getUserCount(uid?: UserEntityUID, username?: string, nickname?: string, signature?: string, email?: string, partialPhone?: string, accountCreateTimeGMTMin?: number, accountCreateTimeGMTMax?: number, accountCreateIP?: string, accountCreateArea?: countries.CountryCode, accountFrozen?: boolean, groupId?: UserGroupGroupID, avatarSalt?: string, lastLoginTimeGMTMin?: number, lastLoginTimeGMTMax?: number, lastActiveTimeGMTMin?: number, lastActiveTimeGMTMax?: number): Promise<number>{
        throw new Error('Method not implemented.');
    }
    searchUser(uid?: UserEntityUID, username?: string, nickname?: string, signature?: string, email?: string, partialPhone?: string, accountCreateTimeGMTMin?: number, accountCreateTimeGMTMax?: number, accountCreateIP?: string, accountCreateArea?: countries.CountryCode, accountFrozen?: boolean, groupId?: UserGroupGroupID, avatarSalt?: string, lastLoginTimeGMTMin?: number, lastLoginTimeGMTMax?: number, lastActiveTimeGMTMin?: number, lastActiveTimeGMTMax?: number, numLimit?: number, startPosition?: number): Promise<SearchResult<UserEntity>>{
        throw new Error('Method not implemented.');
    }
    clearUser(uid?: UserEntityUID, username?: string, nickname?: string, signature?: string, email?: string, partialPhone?: string, accountCreateTimeGMTMin?: number, accountCreateTimeGMTMax?: number, accountCreateIP?: string, accountCreateArea?: countries.CountryCode, accountFrozen?: boolean, groupId?: UserGroupGroupID, avatarSalt?: string, lastLoginTimeGMTMin?: number, lastLoginTimeGMTMax?: number, lastActiveTimeGMTMin?: number, lastActiveTimeGMTMax?: number, numLimit?: number, startPosition?: number): Promise<void>{
        throw new Error('Method not implemented.');
    }

    install(params: UserEntityFactoryInstallInfo): Promise<void> {
        let createTableStatement = 
        `CREATE TABLE user_infos
        (
            uid ${getMySQLTypeForUserUID(this)} NOT NULL AUTO_INCREMENT,
            username VARCHAR(${this.getUsernameMaxLen()}) NOT NULL,
            nickname VARCHAR(${this.getNickNameMaxLen()}),
            signature VARCHAR(${this.getSignatureMaxLen()}),
            passwordHash CHAR(${this.getPasswordHashMaxLen()}),
            email VARCHAR(${this.getEmailMaxLen()}),
            email_verified TINYINT(1) NOT NULL,
            phone CHAR(15),
            phone_verified TINYINT(1) NOT NULL,
            create_time INT UNSIGNED NOT NULL,
            create_ip VARCHAR(45),
            create_area CHAR(2),
            frozen TINYINT(1),
            permissions JSON NOT NULL,
            settings JSON NOT NULL,
            group_id ${getMySQLTypeForUserGroupID(params.userGroupFactory)} NOT NULL,
            avatar_salt ${getMySQLTypeForAvatarSalt(params.avatarEntityFactory)},
            last_login_time UNSIGNED INT NOT NULL,
            last_active_time UNSIGNED INT NOT NULL,
            PRIMARY KEY (uid, username)
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
        let dropCommand = `DROP TABLE user_infos;`;
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
        let clsCommand = `TRUNCATE TABLE user_infos;`;
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

export {UserEntityFactoryMySQL};