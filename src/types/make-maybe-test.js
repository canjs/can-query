var QUnit = require("steal-qunit");

var makeMaybe = require("./make-maybe");
var is = require("./comparisons");
var set = require("../set");
var canReflect = require("can-reflect");

QUnit.module("can-query-logic/types/make-maybe")

class DateStringSet {
    constructor(value){
        this.value = value;
    }
    // used to convert to a number
    valueOf(){
        return this.value == null ? this.value : new Date(this.value).getTime();
    }
}

var ComparisonSet = function(value){
    this.value = value;
};
ComparisonSet.prototype.valueOf = function(){
    return this.value;
};

var MaybeDateStringSet = makeMaybe([null, undefined], DateStringSet);


QUnit.test("construtor normalizes", function(){
    var isNull_3 = new MaybeDateStringSet({
        range: new is.In([null, 3])
    });

    QUnit.deepEqual(isNull_3.range,new is.In([3]), "3 left in range");
    QUnit.deepEqual(isNull_3.enum,new is.In([null]), "range moved to in");

    // with value of values
    var isNull_3AsDateString = new MaybeDateStringSet({
        range: new is.In([new DateStringSet(null), new DateStringSet(3)])
    });
    QUnit.deepEqual(isNull_3AsDateString.range,new is.In([new DateStringSet(3)]), "3 left in range");
    QUnit.deepEqual(isNull_3AsDateString.enum,new is.In([new DateStringSet(null)]), "range moved to in");


    var isNull = new MaybeDateStringSet({
        range: new is.In([null])
    });

    QUnit.deepEqual(isNull.range,set.EMPTY, "empty if only null");
    QUnit.deepEqual(isNull.enum,new is.In([null]), "range moved to in");

    var res = new MaybeDateStringSet({
        range: new is.NotIn([null, 3])
    });
    QUnit.deepEqual(res.range,new is.NotIn([3]), "not in range");
    QUnit.deepEqual(res.enum,new is.In([undefined]), "not in enum");

    res = new MaybeDateStringSet({
        range: new is.And([
            new is.NotIn([null]),
            new is.GreaterThan(4)
        ])
    });
    QUnit.deepEqual(res.range,new is.GreaterThan(4), "And with not in");
    QUnit.deepEqual(res.enum,set.EMPTY, "And with not in");

});

QUnit.test("difference with universal", function(){
    var res;

    var gt3 = new MaybeDateStringSet({
        range: new is.GreaterThan(3)
    });

    res = set.difference( set.UNIVERSAL, gt3 );

    QUnit.deepEqual(res, new MaybeDateStringSet({
        enum: new is.In([null, undefined]),
        range: new is.LessThanEqual(3)
    }), "UNIVERSAL \\ $gt:3");


    res = set.difference( set.UNIVERSAL,
        new MaybeDateStringSet({
            range: new is.In([null])
        })
    );

    QUnit.deepEqual(res, new MaybeDateStringSet({
        range: set.UNIVERSAL,
        enum: new is.In([undefined])
    }), "UNIVERSAL \\ null");


    res = set.difference( set.UNIVERSAL,
        new MaybeDateStringSet({
            range: new is.NotIn([null])
        })
    );

    QUnit.deepEqual(res, new MaybeDateStringSet({
        range: set.UNIVERSAL,
        enum: new is.In([null])
    }), "UNIVERSAL \\ !null");


    res = set.difference( set.UNIVERSAL,
        new MaybeDateStringSet({
            enum: new is.In([null, undefined]),
            range: new is.LessThanEqual(3)
        })
    );
    QUnit.deepEqual(res, gt3, "secondary and primary");

});

QUnit.test("difference", function(){
    var res;

    var gt3 = new MaybeDateStringSet({
        range: new is.GreaterThan(3)
    });

    res = set.difference(
        new MaybeDateStringSet({
            range: new is.GreaterThan(3)
        }),
        new MaybeDateStringSet({
            range: new is.GreaterThan(4)
        }));

    QUnit.deepEqual(res, new MaybeDateStringSet({
        range: set.difference( new is.GreaterThan(3), new is.GreaterThan(4) )
    }), "$gt:3 \\ $gt:4");


    res = set.difference(
        new MaybeDateStringSet({
            range: new is.NotIn([undefined])
        }),
        new MaybeDateStringSet({
            range: new is.LessThanEqual(3),
            enum: new is.In([null])
        })
    );
    QUnit.deepEqual(res, new MaybeDateStringSet({
        range: new is.GreaterThan(3)
    }), "{ne: undef} \\ {lt: 3} | null -> {gte: 3}");


    res = set.difference(
        new MaybeDateStringSet({
            range: new is.NotIn([undefined])
        }),
        new MaybeDateStringSet({
            range: new is.LessThanEqual(3)
        })
    );
    QUnit.deepEqual(res, new MaybeDateStringSet({
        range: new is.GreaterThan(3),
        enum: new is.In([null])
    }), "{ne: undef} \\ {lt: 3}|null -> {gte: 3} | null");


    res = set.difference( set.UNIVERSAL,
        new MaybeDateStringSet({
            range: new is.In([null])
        })
    );


    QUnit.deepEqual(res, new MaybeDateStringSet({
        range: new is.NotIn([null])
    }), "UNIVERSAL \\ null");

    res = set.difference( set.UNIVERSAL,
        new MaybeDateStringSet({
            enum: new is.In([null, undefined]),
            range: new is.LessThanEqual(3)
        })
    );
    QUnit.deepEqual(res, gt3, "secondary and primary");

});

QUnit.test("difference with ComparisonSet", function(){
    var three = new ComparisonSet(3),
        four = new ComparisonSet(3);
    var res;

    var gt3 = new MaybeDateStringSet({
        range: new is.GreaterThan(three)
    });

    res = set.difference(
        new MaybeDateStringSet({
            range: new is.GreaterThan(three)
        }),
        new MaybeDateStringSet({
            range: new is.GreaterThan(four)
        }));

    QUnit.deepEqual(res, new MaybeDateStringSet({
        range: set.difference( new is.GreaterThan(three), new is.GreaterThan(four) )
    }), "$gt:3 \\ $gt:4");


    res = set.difference(
        new MaybeDateStringSet({
            range: new is.NotIn([undefined])
        }),
        new MaybeDateStringSet({
            range: new is.LessThanEqual(three),
            enum: new is.In([null])
        })
    );
    QUnit.deepEqual(res, new MaybeDateStringSet({
        range: new is.GreaterThan(three)
    }), "{ne: undef} \\ {lt: 3} | null -> {gte: 3}");


    res = set.difference(
        new MaybeDateStringSet({
            range: new is.NotIn([undefined])
        }),
        new MaybeDateStringSet({
            range: new is.LessThanEqual(three)
        })
    );
    QUnit.deepEqual(res, new MaybeDateStringSet({
        range: new is.GreaterThan(three),
        enum: new is.In([null])
    }), "{ne: undef} \\ {lt: 3}|null -> {gte: 3} | null");


    res = set.difference( set.UNIVERSAL,
        new MaybeDateStringSet({
            range: new is.In([null])
        })
    );


    QUnit.deepEqual(res, new MaybeDateStringSet({
        range: new is.NotIn([null])
    }), "UNIVERSAL \\ null");


    res = set.difference( set.UNIVERSAL,
        new MaybeDateStringSet({
            enum: new is.In([null, undefined]),
            range: new is.LessThanEqual(three)
        })
    );
    QUnit.deepEqual(res, gt3, "secondary and primary");

});

QUnit.test("intersection", function(){
    var res;

    res = set.intersection(
        new MaybeDateStringSet({
            range: new is.GreaterThan(3),
            enum: new is.In([null])
        }),
        new MaybeDateStringSet({
            range: new is.GreaterThan(5),
            enum: new is.In([null, undefined])
        })
    );

    QUnit.deepEqual(res,
        new MaybeDateStringSet({
            range: new is.GreaterThan(5),
            enum: new is.In([null])
        }),
        "got the right thing"
    );
});

QUnit.test("union", function(){
    var res;

    res = set.union(
        new MaybeDateStringSet({
            range: new is.GreaterThan(3),
            enum: new is.In([null])
        }),
        new MaybeDateStringSet({
            range: new is.GreaterThan(5),
            enum: new is.In([undefined])
        })
    );

    QUnit.deepEqual(res,
        new MaybeDateStringSet({
            range: new is.GreaterThan(3),
            enum: new is.In([null,undefined])
        }),
        "got the right thing"
    );
});




QUnit.test("can make maybe type from normal type and makeMaybeSetType", function(){
    var MaybeNumber =  canReflect.assignSymbols({},{
        "can.new": function(val){
            if (val == null) {
                return val;
            }
            return +(val);
        },
        "can.getSchema": function(){
            return {
                type: "Or",
                values: [Number, undefined, null]
            };
        }
    });

    QUnit.ok( makeMaybe.canMakeMaybeSetType(MaybeNumber), "got everything we need");


    var types = makeMaybe.makeMaybeSetTypes(MaybeNumber);

    var notUndefined = new types.Maybe({
            range: new is.NotIn([new types.ComparisonSetType(undefined)])
        }),
        nullOrLTE3 = new types.Maybe({
            range: new is.LessThanEqual(new types.ComparisonSetType(3)),
            enum: new is.In([new types.ComparisonSetType(null)])
        });

    var res = set.difference(
        notUndefined,
        nullOrLTE3
    );
    QUnit.deepEqual(res, new types.Maybe({
        range: new is.GreaterThan(new types.ComparisonSetType(3))
    }), "{ne: undef} \\ {lt: 3} | null -> {gte: 3}");

});

QUnit.test("can make a maybe type from a ComparisonSetType", function(){
    function toDate(str) {
        var type = typeof str;
        if (type === 'string') {
            str = Date.parse(str);
            return isNaN(str) ? null : new Date(str);
        } else if (type === 'number') {
            return new Date(str);
        } else {
            return str;
        }
    }

    function DateStringSet(dateStr){
        this.setValue = dateStr;
        var date = toDate(dateStr);
        this.value = date == null ? date : date.getTime();
    }

    DateStringSet.prototype.valueOf = function(){
        return this.value;
    };
    canReflect.assignSymbols(DateStringSet.prototype,{
        "can.serialize": function(){
            return this.setValue;
        }
    });

    var MaybeDate = canReflect.assignSymbols({},{
        "can.new": toDate,
        "can.getSchema": function(){
            return {
                type: "Or",
                values: [Date, undefined, null]
            };
        },
        "can.ComparisonSetType": DateStringSet
    });

    QUnit.ok( makeMaybe.canMakeMaybeSetType(MaybeDate), "got everything we need");


    var types = makeMaybe.makeMaybeSetTypes(MaybeDate);

    QUnit.equal( types.ComparisonSetType, DateStringSet, "got the comparison type" );

    var date1982_10_20 = new Date(1982,9,20).toString();

    var notUndefined = new types.Maybe({
            range: new is.NotIn([new types.ComparisonSetType(undefined)])
        }),
        nullOrLTE3 = new types.Maybe({
            range: new is.LessThanEqual(new types.ComparisonSetType(date1982_10_20)),
            enum: new is.In([new types.ComparisonSetType(null)])
        });

    var res = set.difference(
        notUndefined,
        nullOrLTE3
    );
    QUnit.deepEqual(res, new types.Maybe({
        range: new is.GreaterThan(new types.ComparisonSetType(date1982_10_20))
    }), "{ne: undef} \\ {lt: '"+date1982_10_20+"'} | null -> {gte: '"+date1982_10_20+"'}");
});




/*
QUnit.test("intersection", function(){
    var is0_5 = new DisjointOr([
        new is.GreaterThan(0),
        new is.LessThan(5)
    ]);

    var is1_6 = new DisjointOr([
        new is.GreaterThan(1),
        new is.LessThan(6)
    ]);

    var intersection = set.
});

QUnit.test("intersection", function(){
    var is0_5 = new DisjointOr([
        new is.GreaterThan(0),
        new is.LessThan(5)
    ]);

    var is1_6 = new DisjointOr([
        new is.GreaterThan(1),
        new is.LessThan(6)
    ]);

    var intersection = set.
});



QUnit.test("difference", function(){
    var greaterThan3 = new Maybe(new is.GreaterThan(3))
    var res;

    res = set.difference( set.UNIVERSAL, greaterThan3 );

    QUnit.deepEqual(res,);

});
*/