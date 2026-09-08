// Hand-written handlers for jokers whose behaviour the DSL cannot express.
// Each entry: { [trigger]: (ctx, joker, extra, effect) => boolean, retrigger?: (ctx, joker, extra) => number, token?: (name, joker, ctx) => value }
export const CUSTOM_JOKERS = {};
