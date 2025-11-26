var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import * as ReactDOM from "react-dom";
import * as React from "react";
import CustomPanel from "../../components/panel/CustomPanel";
import { Log } from "@microsoft/sp-core-library";
import { BaseListViewCommandSet, } from "@microsoft/sp-listview-extensibility";
var LOG_SOURCE = "DemoCommandCommandSet";
var PANEL_CONTAINER_ID = "demoCommandPanelContainer";
var DemoCommandCommandSet = /** @class */ (function (_super) {
    __extends(DemoCommandCommandSet, _super);
    function DemoCommandCommandSet() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this._onListViewStateChanged = function (args) {
            var _a;
            Log.info(LOG_SOURCE, "List view state changed");
            var compareOneCommand = _this.tryGetCommand("demoCommand");
            if (compareOneCommand) {
                // This command should be hidden unless exactly one row is selected.
                compareOneCommand.visible =
                    ((_a = _this.context.listView.selectedRows) === null || _a === void 0 ? void 0 : _a.length) === 1;
            }
            // TODO: Add your logic here
            // You should call this.raiseOnChage() to update the command bar
            _this.raiseOnChange();
        };
        return _this;
    }
    DemoCommandCommandSet.prototype.onInit = function () {
        Log.info(LOG_SOURCE, "Initialized DemoCommandCommandSet");
        // initial state of the command's visibility
        var compareOneCommand = this.tryGetCommand("demoCommand");
        compareOneCommand.visible = false;
        this.context.listView.listViewStateChangedEvent.add(this, this._onListViewStateChanged);
        return Promise.resolve();
    };
    DemoCommandCommandSet.prototype.onExecute = function (event) {
        switch (event.itemId) {
            case "demoCommand":
                this._renderPanel(event.selectedRows[0]);
                break;
            default:
                throw new Error("Unknown command");
        }
    };
    DemoCommandCommandSet.prototype.onDismiss = function () {
        var panelContainer = document.getElementById(PANEL_CONTAINER_ID);
        if (panelContainer) {
            ReactDOM.unmountComponentAtNode(panelContainer);
            panelContainer.remove();
        }
    };
    //============================================
    DemoCommandCommandSet.prototype._renderPanel = function (selectedRow) {
        var panelContainer = document.getElementById(PANEL_CONTAINER_ID);
        if (!panelContainer) {
            panelContainer = document.createElement("div");
            panelContainer.id = PANEL_CONTAINER_ID;
            document.body.appendChild(panelContainer);
        }
        var element = React.createElement(CustomPanel, {
            onDismiss: this.onDismiss,
            selectedRow: selectedRow,
            context: this.context,
        });
        if (panelContainer) {
            ReactDOM.render(element, document.getElementById(PANEL_CONTAINER_ID));
        }
    };
    return DemoCommandCommandSet;
}(BaseListViewCommandSet));
export default DemoCommandCommandSet;
//# sourceMappingURL=DemoCommandCommandSet.js.map