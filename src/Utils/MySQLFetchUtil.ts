import {Connection, FieldPacket, OkPacket, ResultSetHeader, RowDataPacket} from 'mysql2';
import Query from 'mysql2/typings/mysql/lib/protocol/sequences/Query';
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