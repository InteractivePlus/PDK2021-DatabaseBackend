import { MaskIDEntityFactory } from "../../../PDK2021-BackendCore/dist/AbstractFactoryTypes/MaskID/MaskIDEntityFactory";
import { OAuthTokenFactory } from "../../../PDK2021-BackendCore/dist/AbstractFactoryTypes/OAuth/Token/OAuthTokenFactory";
import { APPEntityFactory } from "../../../PDK2021-BackendCore/dist/AbstractFactoryTypes/RegisteredAPP/APPEntityFactory";
import { UserEntityFactory } from "../../../PDK2021-BackendCore/dist/AbstractFactoryTypes/User/UserEntityFactory";

function getMySQLTypeFor(isNumber : boolean, maxLen : number, exactLen?: number) : string{
    if(isNumber){
        return 'BIGINT';
    }else if(exactLen !== undefined){
        return 'CHAR(' + exactLen + ')';
    }else{
        return 'VARCHAR(' + maxLen + ')';
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

function getMySQLTypeForOAuthToken(oAuthTokenFactory: OAuthTokenFactory<any,any>){
    return getMySQLTypeFor(false,oAuthTokenFactory.getAccessTokenMaxLen(),oAuthTokenFactory.getAccessTokenExactLen !== undefined ? oAuthTokenFactory.getAccessTokenExactLen() : undefined);
}

export {getMySQLTypeForOAuthToken};