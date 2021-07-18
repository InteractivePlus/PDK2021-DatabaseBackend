function getSQLTypeFor(isNumber : boolean, maxLen : number, exactLen?: number) : string{
    if(isNumber){
        return 'BIGINT';
    }else if(exactLen !== undefined){
        return 'CHAR(' + exactLen + ')';
    }else{
        return 'VARCHAR(' + maxLen + ')';
    }
}

export {getSQLTypeFor};