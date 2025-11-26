import * as React from "react";
import { RowAccessor } from "@microsoft/sp-listview-extensibility";
import { ListViewCommandSetContext } from "@microsoft/sp-listview-extensibility";
export interface ICustomPanelProps {
    onDismiss: () => void;
    selectedRow: RowAccessor;
    context: ListViewCommandSetContext;
}
declare const CustomPanel: React.FC<ICustomPanelProps>;
export default CustomPanel;
//# sourceMappingURL=CustomPanel.d.ts.map