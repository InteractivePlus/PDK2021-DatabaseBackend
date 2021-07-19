import { Connection } from "mysql2";
import { APPGroupCreateInfo, APPGroupEntityFactory, APPGroupEntityFactoryInstallInfo } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/RegisteredAPPGroup/APPGroupEntityFactory";
import { BackendAPPSystemSetting } from "@interactiveplus/pdk2021-backendcore/dist/AbstractDataTypes/SystemSetting/BackendAPPSystemSetting";
import { APPGroupEntity } from "@interactiveplus/pdk2021-common/dist/AbstractDataTypes/RegisteredAPPGroup/APPGroupEntity";
import { SearchResult } from "@interactiveplus/pdk2021-common/dist/InternalDataTypes/SearchResult";
import { getMySQLTypeForAvatarSalt } from "./Utils/MySQLTypeUtil";
import { convertErorToPDKStorageEngineError } from "./Utils/MySQLErrorUtil";

class APPGroupEntityFactoryMySQL implements APPGroupEntityFactory{
    constructor(public mysqlConnection : Connection, protected backendAppSystemSetting : BackendAPPSystemSetting){

    }
    getAPPGroupIDMaxLen(): number {
        return this.backendAppSystemSetting.appGroupEntityFormat.groupIdMaxLen !== undefined ? this.backendAppSystemSetting.appGroupEntityFormat.groupIdMaxLen : 20;
    }
    getNickNameMaxLen() : number{
        return this.backendAppSystemSetting.appGroupEntityFormat.nicknameMaxLen !== undefined ? this.backendAppSystemSetting.appGroupEntityFormat.nicknameMaxLen : 20;
    }
    getDescriptionMaxLen() : number{
        return this.backendAppSystemSetting.appGroupEntityFormat.descriptionMaxLen !== undefined ? this.backendAppSystemSetting.appGroupEntityFormat.descriptionMaxLen : 50;
    }
    getAPPSystemSetting(): BackendAPPSystemSetting {
        return this.backendAppSystemSetting;
    }


    createAPPGroupEntity(createInfo: APPGroupCreateInfo): Promise<APPGroupEntity> {
        throw new Error("Method not implemented.");
    }
    getAPPGroupEntity(appGroupId: string): Promise<APPGroupEntity | undefined> {
        throw new Error("Method not implemented.");
    }
    updateAPPGroupEntity(appGroupId: string, appGroupEntity: APPGroupEntity, oldAPPGroupEntity?: APPGroupEntity): Promise<void> {
        throw new Error("Method not implemented.");
    }
    deleteAPPGroupEntity(appGroupId: string): void {
        throw new Error("Method not implemented.");
    }
    getAPPGroupEntityCount(appGroupId?: string, nickname?: string, description?: string, avatarSalt?: string): Promise<number> {
        throw new Error("Method not implemented.");
    }
    searchAPPGroupEntity(appGroupId?: string, nickname?: string, description?: string, avatarSalt?: string, numLimit?: number, startPosition?: number): Promise<SearchResult<APPGroupEntity>> {
        throw new Error("Method not implemented.");
    }
    clearAPPGroupEntity(appGroupId?: string, nickname?: string, description?: string, avatarSalt?: string, numLimit?: number, startPosition?: number): Promise<void> {
        throw new Error("Method not implemented.");
    }

    install(params: APPGroupEntityFactoryInstallInfo): Promise<void> {
        let createTableStatement =
        `CREATE TABLE app_groups
        (
            group_id VARCHAR(${this.getAPPGroupIDMaxLen()}) NOT NULL,
            nickname VARCHAR(${this.getNickNameMaxLen()}),
            description VARCHAR(${this.getDescriptionMaxLen()}),
            permissions JSON NOT NULL,
            settings JSON NOT NULL,
            avatarSalt ${getMySQLTypeForAvatarSalt(params.avatarEntityFactory)},
            PRIMARY KEY (group_id)
        );`;
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
        let dropCommand = `DROP TABLE app_groups;`;
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
        let clsCommand = `TRUNCATE TABLE app_groups;`;
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

export {APPGroupEntityFactoryMySQL};