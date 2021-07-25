import { AvatarEntityFactory } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/Avatar/AvatarEntityFactory";
import { MaskIDEntityFactory } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/MaskID/MaskIDEntityFactory";
import { OAuthTokenFactory } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/OAuth/Token/OAuthTokenFactory";
import { APPEntityFactory } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/RegisteredAPP/APPEntityFactory";
import { UserEntityFactory } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/User/UserEntityFactory";
import { APPGroupEntityFactory } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/RegisteredAPPGroup/APPGroupEntityFactory";
import { UserGroupFactory } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/UserGroup/UserGroupFactory";

function getMySQLTypeFor(isNumber : boolean, maxLen : number, exactLen?: number) : string{
    if(isNumber){
        return 'BIGINT';
    }else if(exactLen !== undefined){
        return 'CHAR(' + exactLen.toString() + ')';
    }else{
        return 'VARCHAR(' + maxLen.toString() + ')';
    }
}

export {getMySQLTypeFor};

function getMySQLTypeForUserUID(userEntityFactory: UserEntityFactory){
    return getMySQLTypeFor(userEntityFactory.isUserUIDNumber(), userEntityFactory.getUserUIDMaxLen(), userEntityFactory.getUserUIDExactLen !== undefined ? userEntityFactory.getUserUIDExactLen() : undefined);
}

export {getMySQLTypeForUserUID};

function getMySQLTypeForMaskIDUID(maskIDEntityFactory: MaskIDEntityFactory){
    return getMySQLTypeFor(false,maskIDEntityFactory.getMaskIDMaxLength(), maskIDEntityFactory.getMaskExactLength !== undefined ? maskIDEntityFactory.getMaskExactLength() : undefined);
}

export {getMySQLTypeForMaskIDUID};

function getMySQLTypeForAPPEntityUID(appEntityFactory: APPEntityFactory){
    return getMySQLTypeFor(appEntityFactory.isAPPUIDNumber(), appEntityFactory.getAPPUIDMaxLen(), appEntityFactory.getAPPUIDExactLen !== undefined ? appEntityFactory.getAPPUIDExactLen() : undefined);
}

export {getMySQLTypeForAPPEntityUID};

function getMySQLTypeForAPPClientID(appEntityFactory: APPEntityFactory){
    return getMySQLTypeFor(false,appEntityFactory.getAPPClientIDMaxLen(),appEntityFactory.getAPPClientIDExactLen !== undefined ? appEntityFactory.getAPPClientIDExactLen() : undefined);
}

export {getMySQLTypeForAPPClientID};

function getMySQLTypeForOAuthToken(oAuthTokenFactory: OAuthTokenFactory){
    return getMySQLTypeFor(false,oAuthTokenFactory.getAccessTokenMaxLen(),oAuthTokenFactory.getAccessTokenExactLen !== undefined ? oAuthTokenFactory.getAccessTokenExactLen() : undefined);
}

export {getMySQLTypeForOAuthToken};

function getMySQLTypeForAvatarSalt(avatarFactory : AvatarEntityFactory){
    return 'CHAR(' + avatarFactory.getAvatarSaltLength().toString() + ')';
}

export {getMySQLTypeForAvatarSalt};

function getMySQLTypeForAPPGroupID(appGroupFactory : APPGroupEntityFactory){
    return getMySQLTypeFor(false,appGroupFactory.getAPPGroupIDMaxLen(),undefined);
}

export {getMySQLTypeForAPPGroupID};

function getMySQLTypeForUserGroupID(userGroupFactory : UserGroupFactory){
    return getMySQLTypeFor(false,userGroupFactory.getUserGroupIDMaxLen(),undefined);
}

export {getMySQLTypeForUserGroupID};