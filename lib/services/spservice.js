var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { spfi, SPFx } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/sites";
import "@pnp/sp/files";
var SPService = /** @class */ (function () {
    function SPService(context) {
        this._sp = spfi()
            .using(SPFx(context));
    }
    SPService.prototype.getListItems = function (listTitle, select, top, filter, expand, orderBy) {
        return __awaiter(this, void 0, void 0, function () {
            var items;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        if (!orderBy) return [3 /*break*/, 2];
                        items = (_a = (_b = this._sp.web.lists
                            .getByTitle(listTitle)
                            .items).select.apply(_b, select).top(top))
                            .expand.apply(_a, (expand || [])).orderBy(orderBy === null || orderBy === void 0 ? void 0 : orderBy.fieldName, orderBy === null || orderBy === void 0 ? void 0 : orderBy.ascending)
                            .filter(filter);
                        return [4 /*yield*/, items()];
                    case 1: return [2 /*return*/, _e.sent()];
                    case 2:
                        items = (_c = (_d = this._sp.web.lists
                            .getByTitle(listTitle)
                            .items).select.apply(_d, select).top(top))
                            .expand.apply(_c, (expand || [])).filter(filter);
                        return [4 /*yield*/, items()];
                    case 3: return [2 /*return*/, _e.sent()];
                }
            });
        });
    };
    SPService.prototype.getFileBlob = function (fileRef) {
        return __awaiter(this, void 0, void 0, function () {
            var path, u, blob, pnperr_1, resp, blob, fetchErr_1, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 10, , 11]);
                        path = fileRef;
                        if (/^https?:\/\//i.test(fileRef)) {
                            try {
                                u = new URL(fileRef);
                                // Use pathname + search for server-relative path
                                path = u.pathname + (u.search || "");
                            }
                            catch (e) {
                                // If URL parsing fails, keep original and fall back to fetch later
                                path = fileRef;
                            }
                        }
                        if (!path.startsWith("/") && !/^https?:\/\//i.test(path)) {
                            path = "/" + path;
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 9]);
                        return [4 /*yield*/, this._sp.web.getFileByServerRelativePath(path).getBlob()];
                    case 2:
                        blob = _a.sent();
                        console.log("Fetched blob size:", blob.size, "for", fileRef);
                        return [2 /*return*/, blob];
                    case 3:
                        pnperr_1 = _a.sent();
                        // PnP failed (maybe different site or path); try fetching directly (include credentials)
                        console.warn("PnP getFileByServerRelativePath failed, falling back to fetch:", pnperr_1);
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 7, , 8]);
                        return [4 /*yield*/, fetch(fileRef, { credentials: "include" })];
                    case 5:
                        resp = _a.sent();
                        if (!resp.ok)
                            throw new Error("Fetch failed ".concat(resp.status));
                        return [4 /*yield*/, resp.blob()];
                    case 6:
                        blob = _a.sent();
                        console.log("Fetched blob via fetch size:", blob.size || "unknown", "for", fileRef);
                        return [2 /*return*/, blob];
                    case 7:
                        fetchErr_1 = _a.sent();
                        console.error("Both PnP and fetch failed to retrieve file:", fetchErr_1);
                        throw fetchErr_1;
                    case 8: return [3 /*break*/, 9];
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        e_1 = _a.sent();
                        console.error("getFileBlob error for", fileRef, e_1);
                        throw e_1;
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    SPService.prototype.getFileText = function (fileRef) {
        return __awaiter(this, void 0, void 0, function () {
            var fileContent, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this._sp.web
                                .getFileByServerRelativePath(fileRef)
                                .getText()];
                    case 1:
                        fileContent = _b.sent();
                        if (!!fileContent) {
                            return [2 /*return*/, fileContent];
                        }
                        return [2 /*return*/, ""];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, ""];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return SPService;
}());
export default SPService;
//# sourceMappingURL=spservice.js.map