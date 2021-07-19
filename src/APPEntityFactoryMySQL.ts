import {Connection} from 'mysql2';
import { BackendAPPSystemSetting } from '../../PDK2021-BackendCore/dist/AbstractDataTypes/SystemSetting/BackendAPPSystemSetting';
import { APPEntityCreateInfo, APPEntityFactory, APPEntityFactoryInstallInfo } from '../../PDK2021-BackendCore/dist/AbstractFactoryTypes/RegisteredAPP/APPEntityFactory';
import { OAuthAuthorizationMethod } from '../../pdk2021-common/dist/AbstractDataTypes/OAuth/OAuthAuthorizationMethod';
import { APPEntity } from '../../pdk2021-common/dist/AbstractDataTypes/RegisteredAPP/APPEntity';
import { APPUID } from '../../pdk2021-common/dist/AbstractDataTypes/RegisteredAPP/APPEntityFormat';
import { UserEntityUID } from '../../pdk2021-common/dist/AbstractDataTypes/User/UserEntity';
import { SearchResult } from '../../pdk2021-common/dist/InternalDataTypes/SearchResult';
import { convertErorToPDKStorageEngineError } from './Utils/MySQLErrorUtil';
import { getMySQLTypeForAPPClientID, getMySQLTypeForAPPEntityUID, getMySQLTypeForAPPGroupID, getMySQLTypeForAvatarSalt, getMySQLTypeForUserUID } from './Utils/MySQLTypeUtil';

class APPEntityFactoryMySQL implements APPEntityFactory{
    constructor(public mysqlConnection : Connection, protected backendAPPSystemSetting : BackendAPPSystemSetting){

    }
    getAPPUIDMaxLen(): number {
        return 5;
    }
    getAPPUIDExactLen(): number{
        return 5;
    }
    isAPPUIDNumber(): boolean {
        return true;
    }
    getAPPClientIDMaxLen(): number {
        return this.getAPPClientIDExactLen();
    }
    getAPPClientIDExactLen(): number{
        return this.backendAPPSystemSetting.appEntityFormat.clientIDCharNum !== undefined ? this.backendAPPSystemSetting.appEntityFormat.clientIDCharNum : 24;
    }
    getAPPClientSecretExactLen(): number{
        return this.backendAPPSystemSetting.appEntityFormat.clientSecretCharNum !== undefined ? this.backendAPPSystemSetting.appEntityFormat.clientSecretCharNum : 32;
    }
    getAPPSystemSetting(): BackendAPPSystemSetting {
        return this.backendAPPSystemSetting;
    }
    getPDKReservedAPPUID(): APPUID {
        return 0;
    }


    createAPPEntity(createInfo: APPEntityCreateInfo): Promise<APPEntity> {
        throw new Error('Method not implemented.');
    }
    verifyAPPEntityCredential(clientID: string, currentGrantType: OAuthAuthorizationMethod, clientSecret?: string): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    getAPPEntity(appuid: APPUID): Promise<APPEntity | undefined> {
        throw new Error('Method not implemented.');
    }
    getAPPEntityByClientID(clientID: string): Promise<APPEntity | undefined> {
        throw new Error('Method not implemented.');
    }
    updateAPPEntity(appuid: APPUID, appEntity: APPEntity, oldAPPEntity?: APPEntity): Promise<void> {
        //Leave this method unimplemented, I will implement this.
        throw new Error('Method not implemented.');
    }
    deleteAPPEntity(appuid: APPUID): Promise<void> {
        throw new Error('Method not implemented.');
    }
    getAPPEntityCount(appuid?: APPUID, clientID?: string, displayName?: string, description?: string, relatedUID?: UserEntityUID, createTimeGMTMin?: number, createTimeGMTMax?: number, lastModifiedTimeGMTMin?: number, lastModifiedTimeGMTMax?: number, avatarSalt?: string, appGroupId?: string): Promise<number> {
        throw new Error('Method not implemented.');
    }
    searchAPPEntity(appuid?: APPUID, clientID?: string, displayName?: string, description?: string, relatedUID?: UserEntityUID, createTimeGMTMin?: number, createTimeGMTMax?: number, lastModifiedTimeGMTMin?: number, lastModifiedTimeGMTMax?: number, avatarSalt?: string, appGroupId?: string, numLimit?: number, startPosition?: number): Promise<SearchResult<APPEntity>> {
        throw new Error('Method not implemented.');
    }
    clearAPPEntity(appuid?: APPUID, clientID?: string, displayName?: string, description?: string, relatedUID?: UserEntityUID, createTimeGMTMin?: number, createTimeGMTMax?: number, lastModifiedTimeGMTMin?: number, lastModifiedTimeGMTMax?: number, avatarSalt?: string, appGroupId?: string, numLimit?: number, startPosition?: number): Promise<void> {
        throw new Error('Method not implemented.');
    }

    getDisplayNameMaxLen() : number{
        return this.backendAPPSystemSetting.appEntityFormat.displayNameMaxLen !== undefined ? this.backendAPPSystemSetting.appEntityFormat.displayNameMaxLen : 12;
    }
    getDescriptionMaxLen() : number{
        return this.backendAPPSystemSetting.appEntityFormat.descriptionMaxLen !== undefined ? this.backendAPPSystemSetting.appEntityFormat.descriptionMaxLen : 30;
    }
    install(params: APPEntityFactoryInstallInfo): Promise<void> {
        let createTableStatement = 
        `CREATE TABLE app_infos
        (
            appuid ${getMySQLTypeForAPPEntityUID(this)} NOT NULL AUTO_INCREMENT,
            client_id ${getMySQLTypeForAPPClientID(this)} NOT NULL,
            client_secret CHAR(${this.getAPPClientSecretExactLen()}) NOT NULL,
            display_name VARCHAR(${this.getDisplayNameMaxLen()}),
            description VARCHAR(${this.getDescriptionMaxLen()}),
            creator_uid ${getMySQLTypeForUserUID(params.userEntityFactory)},
            create_time INT UNSIGNED NOT NULL,
            last_modified_time INT UNSIGNED NOT NULL,
            owner_uid ${getMySQLTypeForUserUID(params.userEntityFactory)},
            avatar ${getMySQLTypeForAvatarSalt(params.avatarEntityFactory)},
            group_id ${getMySQLTypeForAPPGroupID(params.appGroupEntityFactory)} NOT NULL,
            PRIMARY KEY (appuid, client_id)
        );`;
        let createAPPMgInfoTableStatement = 
        `CREATE TABLE app_management_infos
        (
            appuid ${getMySQLTypeForAPPEntityUID(this)} NOT NULL,
            manager_uid ${getMySQLTypeForUserUID(params.userEntityFactory)} NOT NULL
        );`;
        return new Promise<void>((resolve,reject)=>{
            this.mysqlConnection.query(createTableStatement,(err,result,fields)=>{
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }else{
                    this.mysqlConnection.query(createAPPMgInfoTableStatement,(err,result,fields)=>{
                        if(err !== null){
                            reject(convertErorToPDKStorageEngineError(err));
                        }else{
                            resolve();
                        }
                    })
                }
            })
        })
    }
    uninstall(): Promise<void> {
        let dropTableStatement = `DROP TABLE app_infos;`;
        let dropMgTableStatement = `DROP TABLE app_management_infos;`;
        return new Promise<void>((resolve,reject)=>{
            this.mysqlConnection.query(dropTableStatement,(err,result,fields)=>{
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }else{
                    this.mysqlConnection.query(dropMgTableStatement,(err,result,fields)=>{
                        if(err !== null){
                            reject(convertErorToPDKStorageEngineError(err));
                        }else{
                            resolve();
                        }
                    })
                }
            })
        })
    }
    clearData(): Promise<void> {
        let clsTableStatement = `TRUNCATE TABLE app_infos;`;
        let clsMgTableStatement = `TRUNCATE TABLE app_management_infos;`;
        return new Promise<void>((resolve,reject)=>{
            this.mysqlConnection.query(clsTableStatement,(err,result,fields)=>{
                if(err !== null){
                    reject(convertErorToPDKStorageEngineError(err));
                }else{
                    this.mysqlConnection.query(clsMgTableStatement,(err,result,fields)=>{
                        if(err !== null){
                            reject(convertErorToPDKStorageEngineError(err));
                        }else{
                            resolve();
                        }
                    })
                }
            })
        })
    }
    
}