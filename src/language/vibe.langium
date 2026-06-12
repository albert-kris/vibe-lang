grammar Vibe

// ============================================================
// Vibe Programming Language - minimal MVP grammar
// Two document kinds:
//   app    - full-stack product declaration (generates a project)
//   change - AI change-intent declaration (generates a change plan)
// ============================================================

entry Document:
    (apps+=App | changes+=ChangeDecl)*;

App:
    'app' name=ID '{'
        (
            vibes+=VibeDecl
            | styles+=StyleDecl
            | models+=ModelDecl
            | apis+=ApiDecl
            | components+=ComponentDecl
            | pages+=PageDecl
        )*
    '}';

// ------------------------------------------------------------
// vibe { ... } : structured product-intent hints
// ------------------------------------------------------------

VibeDecl:
    'vibe' '{' items+=VibeItem* '}';

VibeItem:
    BrandItem | UxItem | A11yItem | PerfItem | SecurityItem;

BrandItem:
    'brand' value=STRING;

UxItem:
    'ux' priorities+=ID+;

A11yItem:
    'a11y' level=('wcag-aa' | 'wcag-aaa');

PerfItem:
    'perf' '{' budgets+=PerfBudget (',' budgets+=PerfBudget)* '}';

PerfBudget:
    metric=Name '<' value=NUMBER unit=ID?;

SecurityItem:
    'security' profile=('public' | 'trusted' | 'regulated');

// ------------------------------------------------------------
// style { ... } : design tokens
// ------------------------------------------------------------

StyleDecl:
    'style' '{' tokens+=StyleToken* '}';

StyleToken:
    key=TokenPath '=' value=Literal;

TokenPath returns string:
    Name ('.' Name)*;

// ------------------------------------------------------------
// model : persistent data shape
// ------------------------------------------------------------

ModelDecl:
    'model' name=ID '{' fields+=FieldDecl* '}';

FieldDecl:
    name=Name type=FieldType attrs+=FieldAttr* ('=' default=Literal)?;

FieldType returns string:
    'uuid' | 'string' | 'text' | 'int' | 'float' | 'decimal' | 'boolean' | 'datetime';

FieldAttr:
    '@' name=Name ('(' arg=Name ')')?;

// ------------------------------------------------------------
// api : externally callable contract
// ------------------------------------------------------------

ApiDecl:
    'api' method=HttpMethod path=STRING '{'
        (queries+=QueryBlock | returnsDecls+=ReturnsDecl | authDecls+=AuthDecl)*
    '}';

HttpMethod returns string:
    'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

QueryBlock:
    'query' '{' params+=QueryParam* '}';

QueryParam:
    name=Name (optional?='?')? ':' type=FieldType ('=' default=Literal)?;

ReturnsDecl:
    'returns' entity=[ModelDecl:ID] (many?='[' ']')?;

AuthDecl:
    'auth' level=('public' | 'user' | 'admin');

// ------------------------------------------------------------
// component : reusable UI subtree
// ------------------------------------------------------------

ComponentDecl:
    'component' name=ID '(' params+=ComponentParam (',' params+=ComponentParam)* ')' '{'
        elements+=UiElement*
    '}';

ComponentParam:
    name=Name ':' entity=[ModelDecl:ID];

UiElement:
    kind=('image' | 'heading' | 'price' | 'text' | 'button') value=UiValue;

UiValue:
    StringValue | RefValue;

StringValue:
    value=STRING;

RefValue:
    parts+=Name ('.' parts+=Name)*;

// ------------------------------------------------------------
// page : a unique route with loaders and sections
// ------------------------------------------------------------

PageDecl:
    'page' name=ID route=STRING '{'
        (loads+=LoadDecl | heroes+=HeroDecl | sections+=SectionDecl)*
    '}';

LoadDecl:
    'load' binding=Name 'from' method=HttpMethod path=STRING
    ('with' '{' args+=LoadArg (',' args+=LoadArg)* '}')?;

LoadArg:
    name=Name ':' value=Literal;

HeroDecl:
    'hero' '{' ('title' title=STRING)? ('cta' cta=STRING)? '}';

SectionDecl:
    'section' name=ID 'uses' component=[ComponentDecl:ID] 'for' binding=Name;

// ------------------------------------------------------------
// change : Vibe Change Language - describes how AI may modify
// an existing codebase (scope, requirements, acceptance, ...)
// ------------------------------------------------------------

ChangeDecl:
    'change' title=STRING '{'
        'goal' goal=STRING
        (
            scopes+=ScopeBlock
            | requirementBlocks+=RequirementsBlock
            | styleBlocks+=StyleHintsBlock
            | constraintBlocks+=ConstraintsBlock
            | acceptanceBlocks+=AcceptanceBlock
            | rollbacks+=RollbackDecl
        )*
    '}';

ScopeBlock:
    'scope' '{' rules+=ScopeRule* '}';

ScopeRule:
    kind=('allow' | 'forbid') pattern=STRING;

RequirementsBlock:
    'requirements' '{' items+=RequirementItem* '}';

// kind is optional sugar: a bare string defaults to `add`
RequirementItem:
    kind=('add' | 'remove' | 'modify')? text=STRING;

StyleHintsBlock:
    'style' '{' hints+=STRING* '}';

ConstraintsBlock:
    'constraints' '{' items+=STRING* '}';

AcceptanceBlock:
    'acceptance' '{' items+=AcceptanceItem* '}';

// a bare string is a behavioral check (`test`); commands need explicit `run`
AcceptanceItem:
    kind=('test' | 'run')? value=STRING;

RollbackDecl:
    'rollback' strategy=('revert' | 'manual');

// ------------------------------------------------------------
// literals & identifiers
// ------------------------------------------------------------

Literal:
    StringLit | NumberLit | BoolLit;

StringLit:
    value=STRING;

NumberLit:
    value=NUMBER;

BoolLit:
    value=('true' | 'false');

// User-facing identifiers may collide with UI keywords (e.g. a model
// field named "price" or "title"), so allow those keywords as names.
Name returns string:
    ID | 'price' | 'title' | 'text' | 'image' | 'heading' | 'button'
    | 'cta' | 'brand' | 'query' | 'auth' | 'public' | 'user';

hidden terminal WS: /\s+/;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;

terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
terminal NUMBER returns number: /[0-9]+(\.[0-9]+)?/;
terminal STRING: /"(\\.|[^"\\])*"/;
