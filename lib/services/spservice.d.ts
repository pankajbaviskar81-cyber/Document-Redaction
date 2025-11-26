import { ListViewCommandSetContext } from "@microsoft/sp-listview-extensibility";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/sites";
import "@pnp/sp/files";
import { IItems } from "@pnp/sp/items";
export default class SPService {
    private _sp;
    constructor(context: ListViewCommandSetContext);
    getListItems(listTitle: string, select: string[], top: number, filter: string, expand?: string[], orderBy?: {
        fieldName: string;
        ascending: boolean;
    }): Promise<IItems[]>;
    getFileBlob(fileRef: string): Promise<Blob>;
    getFileText(fileRef: string): Promise<string>;
}
//# sourceMappingURL=spservice.d.ts.map