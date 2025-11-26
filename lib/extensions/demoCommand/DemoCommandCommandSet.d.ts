import { BaseListViewCommandSet, type IListViewCommandSetExecuteEventParameters } from "@microsoft/sp-listview-extensibility";
/**
 * If your command set uses the ClientSideComponentProperties JSON input,
 * it will be deserialized into the BaseExtension.properties object.
 * You can define an interface to describe it.
 */
export interface IDemoCommandCommandSetProperties {
    sampleTextOne: string;
    sampleTextTwo: string;
}
export default class DemoCommandCommandSet extends BaseListViewCommandSet<IDemoCommandCommandSetProperties> {
    onInit(): Promise<void>;
    onExecute(event: IListViewCommandSetExecuteEventParameters): void;
    private _onListViewStateChanged;
    private onDismiss;
    private _renderPanel;
}
//# sourceMappingURL=DemoCommandCommandSet.d.ts.map