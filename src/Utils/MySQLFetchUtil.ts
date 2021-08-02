import {Connection, FieldPacket, OkPacket, ResultSetHeader, RowDataPacket} from 'mysql2';
import Query from 'mysql2/typings/mysql/lib/protocol/sequences/Query';
import { PDKUnknownInnerError } from '@interactiveplus/pdk2021-common/dist/AbstractDataTypes/Error/PDKException';
import { convertErorToPDKStorageEngineError } from './MySQLErrorUtil';

type MySQLResult =  RowDataPacket[] | RowDataPacket[][] | OkPacket| OkPacket[] | ResultSetHeader;

function fetchMySQL(connection : Connection, statement : string, params?: any[], prepare : boolean = true) : Promise<{result: MySQLResult, fields: FieldPacket[]}>{
    return new Promise<{result: MySQLResult, fields: FieldPacket[]}>((resolve, reject)=>{
        const returnHandler = (err : Query.QueryError | null, result : MySQLResult, fields : FieldPacket[]) => {
            if(err !== null){
                reject(convertErorToPDKStorageEngineError(err));
            }else{
                resolve({result: result, fields: fields});
            }
        };
        if(prepare){
            if(params !== undefined){
                connection.execute(statement,params,returnHandler);
            }else{
                connection.execute(statement,returnHandler);
            }
        }
    })
}

export {fetchMySQL};

async function fetchMySQLCount(connection : Connection, table : string, whereStatement?: string, params?: any[], prepare : boolean = true) : Promise<number>{
    let statement = 'SELECT count(*) as count FROM ' + table + (whereStatement !== undefined ? ' WHERE ' + whereStatement : '') + ';';
    let fetchResult = await fetchMySQL(connection,statement,params,prepare);
    if(!('length' in fetchResult.result) || fetchResult.result.length < 1 || !('count' in fetchResult.result[0])){
        throw new PDKUnknownInnerError('Unexpected data type received when fetching count from DB');
    }
    return fetchResult.result[0].count;
}

export {fetchMySQLCount};