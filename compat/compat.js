// for can-set compat
var Query = require("../can-query");
var canReflect = require("can-reflect");
var transform = require("can-get/transform/transform");
var makeEnum = require("../src/types/make-enum");
var SET = require("../src/set");

var IsBoolean = function(){

};
makeEnum(IsBoolean,[true, false], function(data) {
    var values = Array.isArray(data) ? data : [data];
    return values.map(function(value){
        if(value === "true") {
            return true;
        } else if(value === "false") {
            return false;
        } else {
            return value;
        }
    });
});

function hasKey(obj, keys, parent, parentKey) {
    if(obj && typeof obj === "object") {
        for(var key in obj) {
            if(keys[key]) {
                if(typeof keys[key] === "function") {
                    parent[parentKey] = keys[key](obj);
                } else {
                    return true;
                }

            } else {
                if( hasKey(obj[key], keys, obj, key) ) {
                    return true;
                }
            }
        }
    }
    return false;
}

var defaultAlgebra;

var set = {
    UNIVERSAL: SET.UNIVERSAL,
    // Nothing
    EMPTY: SET.EMPTY,
    // The set exists, but we lack the language to represent it.
    UNDEFINABLE: SET.UNDEFINABLE,

    // We don't know if this exists. Intersection between two paginated sets.
    UNKNOWABLE: SET.UNKNOWABLE,
    Algebra: function(){
        var mutators = {
            schema: [],
            hydrate: [],
            serialize: []
        };
        canReflect.eachIndex(arguments, function(value){
            for(var prop in value) {
                if(mutators[prop]) {
                    mutators[prop].push(value[prop]);
                } else {
                    throw new Error("can-query: This type of configuration is not supported. Please use can-query directly.")
                }

            }
        });

        var obj = canReflect.assignSymbols({},{
            "can.schema": function(){
                var schema = {
                    kind: "record",
                    identity: [],
                    properties: {}
                };
                mutators.schema.forEach(function(updateSchema){
                    updateSchema(schema);
                });
                if(!schema.identity.length) {
                    schema.identity.push("id");
                }

                return schema;
            }
        });
        return new Query(obj, function(data){

            return mutators.hydrate.reduce(function(last, hydrator){
                return hydrator(last);
            }, {filter: data});
        }, function(data){
            if(SET.isSpecial(data)) {
                return data;
            }
            /*if(data === SET.EMPTY) {
                return false;
            }
            if(data === SET.UNDEFINABLE) {
                return true;
            }*/
            if(Array.isArray(data.filter)){
                // OR is not supported ...
                return SET.UNDEFINABLE;
            }
            var out = mutators.serialize.reduce(function(last, serializer){
                return serializer(last);
            }, data);

            var filter = out.filter;
            if(hasKey(filter, {
                "$ne": true,
                "$in": function(val){ return val["$in"]; }
            })) {
                return SET.UNDEFINABLE;
            }
            delete out.filter;
            return canReflect.assign(out, filter);
        });
    },
    props: {

        boolean: function(prop){
            // create boolean or enum
            return {
                schema: function(schema) {
                    schema.properties[prop] = IsBoolean;
                }
            };
        },
        dotNotation: function(){
            // This will be supported by default
            return {};
        },
        enum: function(property, propertyValues) {
            function Enum(){}
            makeEnum(Enum, propertyValues);
            return {
                schema: function(schema) {
                    schema.properties[property] = Enum;
                }
            };
        },
        id: function(id){
            return {
                "schema": function(schema){
                    schema.identity.push(id);
                }
            };
        },
        offsetLimit: function(offset, limit){
            offset = offset || "offset";
            limit = limit || "limit";

            return {
                // taking what was given and making it a raw query look
                // start -> page.start
                // end -> page.end
                hydrate: function(raw){
                    var clone = canReflect.serialize(raw);
                    if((offset in clone.filter) || (limit in clone.filter)) {
                        clone.page = {};
                    }
                    if(offset in clone.filter) {
                        clone.page.start = parseInt(clone.filter[offset], 10);
                        delete clone.filter[offset];
                    }
                    if(limit in clone.filter) {
                        clone.page.end = (clone.page.start || 0 ) + parseInt(clone.filter[limit], 10) - 1;
                        delete clone.filter[limit];
                    }
                    return clone;
                },
                // taking the normal format and putting it back
                // page.start -> start
                // page.end -> end
                serialize: function(raw){
                    var clone = canReflect.serialize(raw);
                    if(clone.page) {
                        clone[offset] = clone.page.start;
                        clone[limit] = (clone.page.end - clone.page.start) + 1;
                        delete clone.page;
                    }
                    return clone;
                }
            };
        },
        rangeInclusive: function(start, end){
            var hydrateTransfomer = {};
            hydrateTransfomer["filter."+start] = "page.start";
            hydrateTransfomer["filter."+end] = "page.end";

            var serializeTransformer = {
                "page.start": start,
                "page.end": end
            };
            return {
                // taking what was given and making it a raw query look
                // start -> page.start
                // end -> page.end
                hydrate: function(raw){
                    var res = transform(raw, hydrateTransfomer);
                    if(res.page) {
                        if(res.page.start) {
                            res.page.start = parseInt(res.page.start, 10);
                        }
                        if(res.page.end) {
                            res.page.end = parseInt(res.page.end, 10);
                        }
                    }
                    return res;
                },
                // taking the normal format and putting it back
                // page.start -> start
                // page.end -> end
                serialize: function(raw){
                    return transform(raw, serializeTransformer);
                }
            };
        },
        ignore: function(prop){
            return {
                hydrate: function(raw){
                    var clone = canReflect.serialize(raw);
                    delete clone[prop];
                    return clone;
                }
            };
        },
        sort: function(prop, sortFunc){
            if(!prop) {
                prop = "sort";
            }
            if(sortFunc) {
                throw new Error("can-query/compat.sort - sortFunc is not supported");
            }
            var hydrateTransfomer = {};
            hydrateTransfomer["filter."+prop] = "sort";

            var serializeTransformer = {
                "sort": prop
            };
            return {
                hydrate: function(raw){
                    return transform(raw, hydrateTransfomer);
                },
                serialize: function(raw){
                    // TODO: fix bug in transform so it doesn't delete props
                    return prop === "sort" ? raw : transform(raw, serializeTransformer);
                }
            };
        }
    }
};

function makeAlgebra(algebra) {
    if(!algebra) {
        return defaultAlgebra;
    }
    else if(!(algebra instanceof Query) ) {
        return new set.Algebra(algebra);
    }
    return algebra;
}

function makeFromTwoQueries(prop) {
    set[prop] = function( a, b, algebra ){
        return makeAlgebra(algebra)[prop](a, b);
    };
}
makeFromTwoQueries("difference");
makeFromTwoQueries("union");
makeFromTwoQueries("intersection");
makeFromTwoQueries("subset");
makeFromTwoQueries("equal");
makeFromTwoQueries("properSubset");

set.count = function(query, algebra) {
    return makeAlgebra(algebra).count(query);
};

set.comparators = set.props;

defaultAlgebra = new set.Algebra();

module.exports = set;
