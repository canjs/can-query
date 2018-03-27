var set = require("../set");
var assign = require("can-assign");
var arrayUnionIntersectionDifference = require("./array-union-intersection-difference");
var canReflect = require("can-reflect");

var MISSING = {};
function eachInUnique(a, acb, b, bcb, defaultReturn){
	var bCopy = assign({}, b),
		res;
	for (var prop in a) {
		res = acb(prop, a[prop], (prop in b) ? b[prop] : MISSING, a, b);
		if(res !== undefined) {
			return res;
		}
		delete bCopy[prop];
	}
	for (prop in bCopy) {
		res = bcb(prop, MISSING, b[prop], a, b);
		if(res !== undefined) {
			return res;
		}
	}
	return defaultReturn;
}

function keyDiff(valuesA, valuesB) {
	var keyResults = arrayUnionIntersectionDifference(
		Object.keys(valuesA),
		Object.keys(valuesB));
	return {
		aOnlyKeys: keyResults.difference,
		aAndBKeys: keyResults.intersection,
		bOnlyKeys:  arrayUnionIntersectionDifference(
			Object.keys(valuesB),
			Object.keys(valuesA)).difference
	};
}

function  notEmpty(value) {
	return value !== set.EMPTY;
}


module.exports = function(And, Or, Not) {

	And.prototype.isMember = function(props){
		var equal = true;
		canReflect.eachKey(this.values, function(value, key){
			if(value && value.isMember) {
				if(!value.isMember( props[key] ) ) {
					equal = false;
				}
			} else {
				if(value !== props[key]) {
					equal = false;
				}
			}
		});
		return equal;
	}
	if(Or) {
		Or.prototype.isMember = function(props){
			return this.values.some(function(value){
					return value && value.isMember ?
						value.isMember( props ) : value === props;
			});
		};
	}



	function difference(objA, objB){

		var valuesA = objA.values,
			valuesB = objB.values,
			diff = keyDiff(valuesA, valuesB),
			aOnlyKeys = diff.aOnlyKeys,
			aAndBKeys = diff.aAndBKeys,
			bOnlyKeys = diff.bOnlyKeys;

		// check if all aAndB are equal

		// With the shared keys, perform vA \ vB difference. If the DIFFERENCE is:
		// - EMPTY: vA has nothing outside vB. vA is equal or subset of vB.
		//   - IF sB has keys not in sA, the shared keys will be part of the result;
		//     OTHERWISE, if all empty, sA is subset of sB, EMPTY will be returned
		//                (even if sA has some extra own keys)
		// - NON-EMPTY: something in sA that is not in sB
		//   Now we need to figure out if it's "product-able" or not.
		//   Product-able -> some part of B is in A.
		//   Perform B ∩ A intersection.  INTERSECTION is:
		//   - EMPTY: NOT "product-able". DISJOINT.  Must return something.
		//   - non-EMPTY: Use to performa  product (in the future.)
		var sharedKeysAndValues = {},
			productAbleKeysAndData = {},
			disjointKeysAndValues = {};
		aAndBKeys.forEach(function(key){
			var difference = set.difference(valuesA[key], valuesB[key]);
			if(difference === set.EMPTY) {
				sharedKeysAndValues[key] = valuesA[key];
			} else {
				var intersection = set.intersection(valuesA[key], valuesB[key]);
				var isProductable = intersection !== set.EMPTY
				if(isProductable) {
					productAbleKeysAndData[key] = {
						// Products with `difference U intersection` would be subtracted
						// from produts with `intersection`
						difference: difference,
						intersection: intersection
					}
				} else {
					disjointKeysAndValues[key] = valuesA[key];
				}
			}
		});
		var productAbleKeys = Object.keys(productAbleKeysAndData);
		var singleProductKeyAndValue;
		if(productAbleKeys.length === 1) {
			singleProductKeyAndValue = {};
			singleProductKeyAndValue[productAbleKeys[0]] = productAbleKeysAndData[productAbleKeys[0]].difference;
		}

		// Now that we've got the shared keys organized
		// we can make decisions based on this information
		// and A-only and B-only keys.

		// if we have any disjoint keys, these sets can not intersect
		// {age: 21, ...} \ {age: 22, ...} ->  {age: 21, ...}
		if(Object.keys(disjointKeysAndValues).length) {
			return objA;
		}

		// contain all the same keys
		if((aOnlyKeys.length === 0) && (bOnlyKeys.length === 0)) {
			if(productAbleKeys.length > 1) {
				return set.UNDEFINABLE;
			}
			// {color: [RED, GREEN], ...X...} \ {color: [RED], ...X...} -> {color: [GREEN], ...X...}
			else if(productAbleKeys.length === 1){
				assign(sharedKeysAndValues, singleProductKeyAndValue);
				return new And(sharedKeysAndValues);
			} else {
				// {...X...} \ {...X...} -> EMPTY
				return set.EMPTY;
			}
		}
		// sA is likely a subset of sB
		if(aOnlyKeys.length > 0 && bOnlyKeys.length === 0) {
			if(productAbleKeys.length > 1) {
				return set.UNDEFINABLE;
			}
			// {age: 35, color: [RED, GREEN], ...X...} \ {color: [RED], ...X...} -> {age: 35, color: [GREEN], ...X...}
			else if(productAbleKeys.length === 1){
				assign(sharedKeysAndValues, singleProductKeyAndValue);
				aOnlyKeys.forEach(function(key){
					sharedKeysAndValues[key] = valuesA[key];
				});
				return new And(sharedKeysAndValues);
			} else {
				// sharedKeysAndValues
				return set.EMPTY;
			}
		}
		// sB is likely subset of sA
		// {}, {foo: "bar"} -> {foo: NOT("bar")}
		if(aOnlyKeys.length === 0 && bOnlyKeys.length > 0) {
			// Lets not figure out productAbleKeys right now.
			// Example:
			// {color: [RED, GREEN], ...X...}
			// \ {age: 35, color: [RED], ...X...}
			// = OR( {color: [GREEN], ...X...}, {age: NOT(35), color: [RED], ...X...} )
			if(productAbleKeys.length > 1) {
				return set.UNDEFINABLE;
			}
			var productAbleOr;
			if(productAbleKeys.length === 1) {
				// we add the intersection to the AND
				// the difference is the or
				var productableKey = productAbleKeys[0];
				productAbleOr = assign({},sharedKeysAndValues);
				productAbleOr[productableKey] = productAbleKeysAndData[productableKey].difference;
				sharedKeysAndValues[productableKey] = productAbleKeysAndData[productableKey].intersection;
			}

			var ands = bOnlyKeys.map(function(key){
				var shared = assign({},sharedKeysAndValues);
				var result = shared[key] = set.difference(set.UNIVERSAL, valuesB[key]);
				return result === set.EMPTY ? result : new And(shared);
			}).filter(notEmpty);

			if(productAbleOr) {
				ands.push(new And(productAbleOr))
			}

			// {c: "g"}
			// \ {c: "g", age: 22, name: "justin"}
			// = OR[ AND(name: NOT("justin"), c:"g"), AND(age: NOT(22), c: "g") ]
			if(ands.length > 1) {
				return new Or(ands);
			} else if(ands.length === 1) {
				// {c: "g"}
				// \ {c: "g", age: 22}
				// = AND(age: NOT(22), c: "g")
				return ands[0];
			} else {
				return set.EMPTY;
			}
		}

		// {name: "Justin"} \\ {age: 35} -> {name: "Justin", age: NOT(35)}
		if(aOnlyKeys.length > 0 && bOnlyKeys.length > 0) {
			if(productAbleKeys.length) {
				throw new Error("Can't handle any productable keys right now")
			}
			// add everything in sA into the result:
			aOnlyKeys.forEach(function(key){
				sharedKeysAndValues[key] = valuesA[key];
			});

			if(bOnlyKeys.length === 1) {
				// TODO: de-duplicate below
				var key = bOnlyKeys[0];
				var shared = assign({},sharedKeysAndValues);
				shared[key] = set.difference(set.UNIVERSAL,valuesB[key]);
				return new And(shared);
			}
			// {foo: "bar"} \\ {name: "Justin", age: 35} -> UNDEFINABLE
			else {
				return set.UNDEFINABLE;
			}

		}
	}

	function checkIfUniversalAndReturnUniversal(setA) {
		return set.isEqual(setA, set.UNIVERSAL) ? set.UNIVERSAL : setA;
	}

    set.defineComparison(And, And,{
        // {name: "Justin"} or {age: 35} -> new OR[{name: "Justin"},{age: 35}]
        // {age: 2} or {age: 3} -> {age: new OR[2,3]}
        // {age: 3, name: "Justin"} OR {age: 4} -> {age: 3, name: "Justin"} OR {age: 4}
        union: function(objA, objB){
			// first see if we can union a single property
			// {age: 21, color: ["R"]} U {age: 21, color: ["B"]} -> {age: 21, color: ["R","B"]}

			var diff = keyDiff(objA.values, objB.values);


			// find the different keys
			var aAndBKeysThatAreNotEqual = [],
				sameKeys= {};

			diff.aAndBKeys.forEach(function(key){
				if(!set.isEqual(objA.values[key], objB.values[key])) {
					aAndBKeysThatAreNotEqual.push(key)
				} else {
					sameKeys[key] = objA.values[key];
				}
			});

			// if all keys are shared
			if(!diff.aOnlyKeys.length && !diff.bOnlyKeys.length) {

				if(aAndBKeysThatAreNotEqual.length === 1) {
					var keyValue = aAndBKeysThatAreNotEqual[0];

                    var result = sameKeys[keyValue] = set.union(objA.values[keyValue], objB.values[keyValue]);

					// if there is only one property, we can just return the universal set
					return canReflect.size(sameKeys) === 1 && set.isEqual(result, set.UNIVERSAL) ?
						set.UNIVERSAL : new And(sameKeys);
				}  else if(aAndBKeysThatAreNotEqual.length === 0){
					// these things are equal
					return objA;
				}
			}
			// If everything shared is the same
			if(aAndBKeysThatAreNotEqual.length === 0 ) {
				// the set with the extra keys is a subset
				if( diff.aOnlyKeys.length > 0 && diff.bOnlyKeys.length === 0) {
					return checkIfUniversalAndReturnUniversal(objB);
				} else if( diff.aOnlyKeys.length === 0 && diff.bOnlyKeys.length > 0 ) {
					return checkIfUniversalAndReturnUniversal(objA);
				}
			}

			if(Or) {
                return new Or([objA.values, objB.values]);
            } else {
                return set.UNDEFINABLE;
            }
        },
        // {foo: zed, abc: d}
        intersection: function(objA, objB){
            // combine all properties ... if the same property, try to take
            // an intersection ... if an intersection isn't possible ... freak out?
            var valuesA = objA.values,
                valuesB = objB.values,
                foundEmpty = false;
            var resultValues = {};
            eachInUnique(valuesA,
                function(prop, aVal, bVal){
                    resultValues[prop] = bVal === MISSING ? aVal : set.intersection(aVal, bVal);
                    if(resultValues[prop] === set.EMPTY) {
                        foundEmpty = true;
                    }
                },
                valuesB,
                function(prop, aVal, bVal) {
                    resultValues[prop] = bVal;
                    if(resultValues[prop] === set.EMPTY) {
                        foundEmpty = true;
                    }
                });
            if(foundEmpty) {
                return set.EMPTY;
            } else {
                return new And(resultValues);
            }

        },
        // A \ B -> what's in A, but not in B
        difference: difference
    });

    set.defineComparison(set.UNIVERSAL,And,{
        // A \ B -> what's in A, but not in B
        difference: function(universe, and){
            if(Or) {
                return difference({values: {}}, and);
            } else {
                return set.UNDEFINABLE;
            }
        }
    });

	if(Or) {
		set.defineComparison(set.UNIVERSAL, Or,{
			difference: function(universal, or){
				return set.UNDEFINABLE;
			}
		})
	}
};
