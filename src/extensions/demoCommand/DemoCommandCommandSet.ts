import * as ReactDOM from "react-dom";
import * as React from "react";
import CustomPanel from "../../components/panel/CustomPanel";
import { Log } from "@microsoft/sp-core-library";
import {
  BaseListViewCommandSet,
  RowAccessor,
  type Command,
  type IListViewCommandSetExecuteEventParameters,
  type ListViewStateChangedEventArgs,
} from "@microsoft/sp-listview-extensibility";
/**
 * If your command set uses the ClientSideComponentProperties JSON input,
 * it will be deserialized into the BaseExtension.properties object.
 * You can define an interface to describe it.
 */
export interface IDemoCommandCommandSetProperties {
  // This is an example; replace with your own properties
  sampleTextOne: string;
  sampleTextTwo: string;
}

const LOG_SOURCE: string = "DemoCommandCommandSet";
const PANEL_CONTAINER_ID = "demoCommandPanelContainer";

export default class DemoCommandCommandSet extends BaseListViewCommandSet<IDemoCommandCommandSetProperties> {
  public onInit(): Promise<void> {
    Log.info(LOG_SOURCE, "Initialized DemoCommandCommandSet");

    // initial state of the command's visibility
    const compareOneCommand: Command = this.tryGetCommand("demoCommand");
    compareOneCommand.visible = false;

    this.context.listView.listViewStateChangedEvent.add(
      this,
      this._onListViewStateChanged
    );

    return Promise.resolve();
  }

  public onExecute(event: IListViewCommandSetExecuteEventParameters): void {
    switch (event.itemId) {
      case "demoCommand":
        this._renderPanel(event.selectedRows[0]);
        break;
      default:
        throw new Error("Unknown command");
    }
  }

  private _onListViewStateChanged = (
    args: ListViewStateChangedEventArgs
  ): void => {
    Log.info(LOG_SOURCE, "List view state changed");

    const compareOneCommand: Command = this.tryGetCommand("demoCommand");
    if (compareOneCommand) {
      // This command should be hidden unless exactly one row is selected.
      compareOneCommand.visible =
        this.context.listView.selectedRows?.length === 1;
    }

    // TODO: Add your logic here

    // You should call this.raiseOnChage() to update the command bar
    this.raiseOnChange();
  };

  private onDismiss(): void {
    const panelContainer = document.getElementById(PANEL_CONTAINER_ID);
    if (panelContainer) {
      ReactDOM.unmountComponentAtNode(panelContainer);
      panelContainer.remove();
    }
  }

  //============================================

  private _renderPanel(selectedRow: RowAccessor) {
    let panelContainer = document.getElementById(PANEL_CONTAINER_ID);

    if (!panelContainer) {
      panelContainer = document.createElement("div");
      panelContainer.id = PANEL_CONTAINER_ID;
      document.body.appendChild(panelContainer);
    }

    const element = React.createElement(CustomPanel, {
      onDismiss: this.onDismiss,
      selectedRow: selectedRow,
      context: this.context,
    });

    if (panelContainer) {
      ReactDOM.render(element, document.getElementById(PANEL_CONTAINER_ID));
    }
  }
}
