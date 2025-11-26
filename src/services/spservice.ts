import { ListViewCommandSetContext } from "@microsoft/sp-listview-extensibility";
import { spfi, SPFI, SPFx } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/sites";
import "@pnp/sp/files";
import { IItems } from "@pnp/sp/items";

export default class SPService {
  private _sp: SPFI;
 
  constructor(context: ListViewCommandSetContext) {
    this._sp = spfi()
      .using(SPFx(context));
  }

  public async getListItems(
    listTitle: string,
    select: string[],
    top: number,
    filter: string,
    expand?: string[],
    orderBy?: { fieldName: string; ascending: boolean }
  ): Promise<IItems[]> {
    let items: IItems;
    if (orderBy) {
      items = this._sp.web.lists
        .getByTitle(listTitle)
        .items.select(...select)
        .top(top)
        .expand(...(expand || []))
        .orderBy(orderBy?.fieldName, orderBy?.ascending)
        .filter(filter);
      return await items();
    }
    items = this._sp.web.lists
      .getByTitle(listTitle)
      .items.select(...select)
      .top(top)
      .expand(...(expand || []))
      .filter(filter);
    return await items();
  }

 public async getFileBlob(fileRef: string): Promise<Blob> {
  // Accept server-relative path or absolute URL. Try PnP first, fallback to fetch.
  try {
    let path = fileRef;
    if (/^https?:\/\//i.test(fileRef)) {
      try {
        const u = new URL(fileRef);
        // Use pathname + search for server-relative path
        path = u.pathname + (u.search || "");
      } catch (e) {
        // If URL parsing fails, keep original and fall back to fetch later
        path = fileRef;
      }
    }

    if (!path.startsWith("/") && !/^https?:\/\//i.test(path)) {
      path = "/" + path;
    }

    try {
      const blob = await this._sp.web.getFileByServerRelativePath(path).getBlob();
      console.log("Fetched blob size:", blob.size, "for", fileRef);
      return blob;
    } catch (pnperr) {
      // PnP failed (maybe different site or path); try fetching directly (include credentials)
      console.warn("PnP getFileByServerRelativePath failed, falling back to fetch:", pnperr);
      try {
        const resp = await fetch(fileRef, { credentials: "include" });
        if (!resp.ok) throw new Error(`Fetch failed ${resp.status}`);
        const blob = await resp.blob();
        console.log("Fetched blob via fetch size:", (blob as any).size || "unknown", "for", fileRef);
        return blob;
      } catch (fetchErr) {
        console.error("Both PnP and fetch failed to retrieve file:", fetchErr);
        throw fetchErr;
      }
    }
  } catch (e) {
    console.error("getFileBlob error for", fileRef, e);
    throw e;
  }
}

  public async getFileText(fileRef: string): Promise<string> {
    try {
      const fileContent = await this._sp.web
        .getFileByServerRelativePath(fileRef)
        .getText();
      if (!!fileContent) {
        return fileContent;
      }
      return "";
    } catch  {
      return "";
    }
  }

 }
