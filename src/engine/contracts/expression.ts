export type ValueSource =
  | 'const'
  | 'res'
  | 'spotLevel'
  | 'areaSpotCount'
  | 'managerCount'
  | 'funclet'
  | 'data';

export interface Value {
  type: 'value';
  source: ValueSource;
  params: Record<string, string | number>;
}

export type ValueExpression =
  | { type: 'const'; value: number }
  | { type: 'value'; value: Value }
  | { type: 'add' | 'sub' | 'mul' | 'div' | 'min' | 'max' | 'pow'; left: ValueExpression; right: ValueExpression }
  | { type: 'floor' | 'ceil' | 'round'; expr: ValueExpression }
  | { type: 'clamp'; expr: ValueExpression; min: ValueExpression; max: ValueExpression };
