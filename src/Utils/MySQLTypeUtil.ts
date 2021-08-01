import { AvatarEntityFactory } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/Avatar/AvatarEntityFactory";
import { MaskIDEntityFactory } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/MaskID/MaskIDEntityFactory";
import { OAuthTokenFactory } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/OAuth/Token/OAuthTokenFactory";
import { APPEntityFactory } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/RegisteredAPP/APPEntityFactory";
import { UserEntityFactory } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/User/UserEntityFactory";
import { APPGroupEntityFactory } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/RegisteredAPPGroup/APPGroupEntityFactory";
import { UserGroupFactory } from "@interactiveplus/pdk2021-backendcore/dist/AbstractFactoryTypes/UserGroup/UserGroupFactory";
import { TicketRecordFactory } from "../../../PDK2021-BackendCore/dist/AbstractFactoryTypes/EXT-Ticket/TicketRecordFactory";
import { UserTokenFactory } from "../../../PDK2021-BackendCore/dist/AbstractFactoryTypes/User/UserTokenFactory";

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
    return getMySQLTypeFor(maskIDEntityFactory.isMaskIDNumber(),maskIDEntityFactory.getMaskIDMaxLength(), maskIDEntityFactory.getMaskIDExactLength !== undefined ? maskIDEntityFactory.getMaskIDExactLength() : undefined);
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

function getMySQLTypeForTicketID(ticketRecordFactory: TicketRecordFactory){
    return getMySQLTypeFor(ticketRecordFactory.isTicketIDNumber(),ticketRecordFactory.getTicketIDMaxLen(),ticketRecordFactory.getTicketIDExactLen !== undefined ? ticketRecordFactory.getTicketIDExactLen() : undefined);
}

export {getMySQLTypeForTicketID};

function getMySQLTypeForUserAccessToken(userTokenFactory: UserTokenFactory){
    return getMySQLTypeFor(false,userTokenFactory.getAccessTokenMaxLen(),userTokenFactory.getAccessTokenExactLen !== undefined ? userTokenFactory.getAccessTokenExactLen() : undefined);
}

export {getMySQLTypeForUserAccessToken};