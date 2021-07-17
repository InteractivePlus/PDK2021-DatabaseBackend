import {QueryError} from 'mysql2';
import { PDKStorageEngineError, PDKStorageEngineErrorParamType } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Error/PDKException';

function convertErorToPDKStorageEngineError(err : QueryError) : PDKStorageEngineError{
    let errorParams : PDKStorageEngineErrorParamType = {
        storageEngineName: 'MySQL',
        storageErrorDescription: err.code + ':' + err.sqlState
    }
    return new PDKStorageEngineError(errorParams);
}

export {convertErorToPDKStorageEngineError};