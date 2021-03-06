import { Context, Allowed } from "./context";
import { DataApiSettings } from "./data-api";
import { Column } from "./column";
import { FilterBase } from './filter/filter-interfaces';
import { __EntityValueProvider } from './__EntityValueProvider';
import { valueOrExpressionToValue } from './column-interfaces';
import { AndFilter } from './filter/and-filter';
import { SortSegment, Sort } from './sort';



//@dynamic
export class Entity<idType = any> {
  __decorateWhere(where: FilterBase): FilterBase {
    if (this.__options.fixedWhereFilter) {
      return new AndFilter(where, this.__options.fixedWhereFilter());
    }
    return where;
  }

  constructor(options?: EntityOptions | string) {
    if (options) {
      if (typeof (options) === "string") {
        this.__options = { name: options };
      } else {
        this.__options = options;
        if (options.saving)
          this.__onSavingRow = (proceedWithoutSavingToDb: () => void) => options.saving(proceedWithoutSavingToDb);
        if (options.validation)
          this.__onValidate = () => options.validation(this);
      }
    }
    else {
      this.__options = {
        name: undefined
      };
    }
  }



  //@internal 
  _getEntityApiSettings(r: Context): DataApiSettings<Entity> {

    let options = this.__options;
    if (options.allowApiCRUD) {
      options.allowApiDelete = true;
      options.allowApiInsert = true;
      options.allowApiUpdate = true;
    }
    return {
      allowRead: r.isAllowed(options.allowApiRead),
      allowUpdate: r.isAllowed(options.allowApiUpdate),
      allowDelete: r.isAllowed(options.allowApiDelete),
      allowInsert: r.isAllowed(options.allowApiInsert),
      get: {
        where: x => options.apiDataFilter ? options.apiDataFilter() : undefined
      }
    }

  }
  //@internal
  __options: EntityOptions;
  //@internal
  private _defs: EntityDefs;
  get defs() {
    if (!this._defs)
      this._defs = new EntityDefs(this.__options);
    return this._defs;
  }



  //@internal
  __entityData = new __EntityValueProvider();

  //@internal
  __onSavingRow: (proceedWithoutSavingToDb: () => void) => void | Promise<void> = () => { };
  //@internal
  __onValidate: () => void | Promise<void> = () => { };

  validationError: string;
  //@internal
  private __idColumn: Column<idType>;
  //@internal
  __initColumns(idColumn?: Column<idType>) {
    if (!this.__options.name) {
      this.__options.name = this.constructor.name;
    }
    if (idColumn)
      this.__idColumn = idColumn;
    let x = <any>this;
    for (let c in x) {
      let y = x[c];

      if (y instanceof Column) {
        if (!y.defs.key)
          y.defs.key = c;
        if (!this.__idColumn && y.defs.key == 'id')
          this.__idColumn = y;


        this.__applyColumn(y);
      }
    }
    if (!this.__idColumn)
      this.__idColumn = this.__columns[0];
  }
  isValid() {
    let ok = true;
    this.__columns.forEach(c => {
      if (c.validationError)
        ok = false;
    });
    return ok;
  }
  isNew() {
    return this.__entityData.isNewRow();
  }
  //@internal
  private __getValidationError() {
    let result: any = {};
    result.modelState = {};
    this.__columns.forEach(c => {
      if (c.validationError) {
        result.modelState[c.defs.key] = c.validationError;
        if (!result.message) {
          result.message = c.defs.caption + ":" + c.validationError;
        }
      }
    });
    return result;
  }
  //@internal
  private __assertValidity() {
    if (!this.isValid()) {

      throw this.__getValidationError();
    }
  }
  async save(afterValidationBeforeSaving?: (row: this) => Promise<any> | any) {
    this.__clearErrors();

    this.__columns.forEach(c => {
      c.__performValidation();
    });

    if (this.__onValidate)
      this.__onValidate();
    if (afterValidationBeforeSaving)
      await afterValidationBeforeSaving(this);
    this.__assertValidity();
    let doNotSave = false;
    await this.__onSavingRow(() => doNotSave = true);
    this.__assertValidity();
    return await this.__entityData.save(this, doNotSave, this.__options.saved).catch(e => this.catchSaveErrors(e));
  }
  //@internal
  private catchSaveErrors(err: any): any {
    let e = err;

    if (e instanceof Promise) {
      return e.then(x => this.catchSaveErrors(x));
    }
    if (e.error) {
      e = e.error;
    }

    if (e.message)
      this.validationError = e.message;
    else if (e.Message)
      this.validationError = e.Message;
    else this.validationError = e;
    let s = e.modelState;
    if (!s)
      s = e.ModelState;
    if (s) {
      Object.keys(s).forEach(k => {
        let c = this.columns.find(k);
        if (c)
          c.validationError = s[k];
      });
    }
    throw err;

  }

  async delete() {
    this.__clearErrors();
    if (this.__options.deleting)
      await this.__options.deleting();
    this.__assertValidity();
    return this.__entityData.delete(this.__options.deleted).catch(e => this.catchSaveErrors(e));

  }
  undoChanges() {
    this.__entityData.reset();
    this.__clearErrors();
  }
  async reload() {
    await this.__entityData.reload(this);
  }
  //@internal
  __clearErrors() {
    this.__columns.forEach(c => c.__clearErrors());
    this.validationError = undefined;
  }
  wasChanged() {
    return this.__entityData.wasChanged();
  }





  //@internal
  __applyColumn(y: Column) {
    if (!y.defs.caption)
      y.defs.caption = makeTitle(y.defs.key);
    y.__valueProvider = this.__entityData;
    if (this.__columns.indexOf(y) < 0)
      this.__columns.push(y);
  }

  //@internal
  private __columns: Column[] = [];
  get columns() {
    return new EntityColumns(this.__columns, this.__idColumn);
  }


}
export interface EntityOptions {
  /**
 * @description
 * A unique identifier that represents this entity, it'll also be used as the api route for this entity.
 * @publicApi
 */
  name: string;
  /**
   * The name of the table in the database that holds the data for this entity.
   * If no name is set, the `name` will be used instead.
   * @example
   * dbName = 'myProducts'
   * @example
   * dbName = () => 'select distinct name from Products`
   */
  dbName?: string | (() => string);
  /**A human readable name for the entity */
  caption?: string;
  /** @see [allowed](http://remult-ts.github.io/guide/allowed.html)*/
  allowApiRead?: Allowed;
  /** @see [allowed](http://remult-ts.github.io/guide/allowed.html)*/
  allowApiUpdate?: Allowed;
  /** @see [allowed](http://remult-ts.github.io/guide/allowed.html)*/
  allowApiDelete?: Allowed;
  /** @see [allowed](http://remult-ts.github.io/guide/allowed.html)*/
  allowApiInsert?: Allowed;
  /** sets  the `allowApiUpdate`, `allowApiDelete` and `allowApiInsert` properties in a single set */
  allowApiCRUD?: Allowed;
  /** A filter that determines which rows can be queries using the api.
   * @example
   * 
   * apiDataFilter: () => {
       if (!context.isSignedIn())
          return this.availableTo.isGreaterOrEqualTo(new Date());
       }
  */
  apiDataFilter?: () => FilterBase;
  /** A filter that will be used for all queries from this entity both from the API and from within the server.
   * @example
   * fixedWhereFilter: () => this.archive.isEqualTo(false)
   */
  fixedWhereFilter?: () => FilterBase;
  /** An order by to be used, in case no order by was specified
   * @example
   * defaultOrderBy: () => this.name
   * 
   * @example
   * defaultOrderBy: () => [this.price, this.name]
   * 
   * @example
   * defaultOrderBy: () => [{ column: this.price, descending: true }, this.name]
   */
  defaultOrderBy?: (() => Sort) | (() => (Column)) | (() => (Column | SortSegment)[])
  /** An event that will be fired before the Entity will be saved to the database.
  * If the `validationError` property of the entity or any of it's columns will be set, the save will be aborted and an exception will be thrown.
  * this is the place to run logic that we want to run in any case before an entity is saved. 
  * @example
  * saving: async () => {
      if (context.onServer) {
        if (this.isNew()) {
            this.createDate.value = new Date();
        }
      }
    }
  */
  saving?: (proceedWithoutSavingToDb: () => void) => Promise<any> | any;
  /** will be called after the Entity was saved to the data source. */
  saved?: () => Promise<any> | any
  /** Will be called before an Entity is deleted. */
  deleting?: () => Promise<any> | any
  /** Will be called after an Entity is deleted */
  deleted?: () => Promise<any> | any

  validation?: (e: Entity) => Promise<any> | any;
}

function makeTitle(name: string) {

  // insert a space before all caps
  return name.replace(/([A-Z])/g, ' $1')
    // uppercase the first character
    .replace(/^./, (str) => str.toUpperCase()).replace('Email', 'eMail').replace(" I D", " ID");

}
export class EntityDefs {

  constructor(private __options: EntityOptions) {

  }
  get name() {
    return this.__options.name;
  }
  get dbName() {
    if (!this.__options.dbName)
      this.__options.dbName = this.name;
    return valueOrExpressionToValue(this.__options.dbName);
  }
  get caption() {
    if (!this.__options.caption) {
      this.__options.caption = makeTitle(this.name);
    }
    return this.__options.caption;
  }
}
export class EntityColumns<T>{
  constructor(private __columns: Column[], public readonly idColumn: Column<T>) {

  }
  [Symbol.iterator]() {
    return this.__columns[Symbol.iterator]();
  }
  toArray() {
    return [...this.__columns];
  }



  find(key: string | Column) {
    let theKey: string;
    if (key instanceof Column)
      theKey = key.defs.key;
    else
      theKey = key;
    for (const c of this.__columns) {
      if (c.defs.key == theKey)
        return c;
    }
    return undefined;
  }

}
