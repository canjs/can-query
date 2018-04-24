require("./src/types/make-real-number-range-inclusive-test");
require("./src/types/comparisons-test");
require("./src/types/and-or-not-test");
require("./src/types/or-values-test");
require("./src/types/basic-query-sorting-test");
require("./src/types/basic-query-filter-from-test");
require("./src/types/basic-query-merge-test");
require("./src/serializers/basic-query-test");
require("./src/serializers/comparisons-test");
require("./src/types/make-maybe-test");
require("./compat/compat-test");
require("./test/special-comparison-logic-test");
require("./test/make-enum-logic-test");
require("./test/maybe-type-test");

var QUnit = require("steal-qunit");
var QueryLogic = require("can-query-logic");
var canReflect = require("can-reflect");


var algebra = new QueryLogic();


QUnit.module("can-query-logic");



QUnit.test("union", function(){
    var unionResult = algebra.union({
        filter: {
            name: "Ramiya"
        }
    },{
        filter: {
            name: "Bohdi"
        }
    });

    QUnit.deepEqual(unionResult, {
        filter: {
            name: {$in: ["Ramiya", "Bohdi"]},
        }
    });
});

QUnit.test("difference", function(){
    var differenceResult = algebra.difference({
        filter: {
            name: {$in: ["Ramiya", "Bohdi"]}
        }
    },{
        filter: {
            name: "Bohdi"
        }
    });

    QUnit.deepEqual(differenceResult, {
        filter: {
            name: "Ramiya",
        }
    });
});

QUnit.test("subset", function(){
    var subsetResult = algebra.isSubset({
        filter: {
            name: "Bohdi"
        }
    },{
        filter: {
            name: {$in: ["Ramiya", "Bohdi"]}
        }
    });

    QUnit.deepEqual(subsetResult,true);
});

QUnit.test("isMember", function(){
    var hasResult = algebra.isMember({
        filter: {
            name: "Bohdi"
        }
    },{
        name: "Bohdi"
    });

    QUnit.deepEqual(hasResult,true);
});

QUnit.test("filterMembers basics", function(){
    var subset = algebra.filterMembers({
        filter: {
            name: {$in: ["Bohdi","Ramiya"]}
        }
    },{}, [
        {name: "Bohdi"},
        {name: "Ramiya"},
        {name: "Payal"},
        {name: "Justin"}
    ]);

    QUnit.deepEqual(subset,[
        {name: "Bohdi"},
        {name: "Ramiya"}
    ]);

    subset = algebra.filterMembers({
        filter: {
            name: {$in: ["Payal","Ramiya","Justin"]}
        },
        page: {start: "1", end: "2"}
    },{}, [
        {name: "Bohdi"},
        {name: "Ramiya"},
        {name: "Payal"},
        {name: "Justin"}
    ]);

    QUnit.deepEqual(subset,[
        {name: "Payal"},
        {name: "Justin"}
    ]);
});


QUnit.test("unionMembers basics", function(){
    var union = algebra.unionMembers({
        filter: {
            name: "Bohdi"
        }
    },{
        filter: {
            name: "Ramiya"
        }
    }, [
        {name: "Bohdi", id: 1},
    ],[
        {name: "Ramiya", id: 2},
    ]);

    QUnit.deepEqual(union,[
        {name: "Bohdi", id: 1},
        {name: "Ramiya", id: 2}
    ]);
});

QUnit.test("count basics", function(){

    QUnit.equal(algebra.count({}), Infinity);
    QUnit.equal(algebra.count({page: {start: 1, end: 2}}), 2);


});

QUnit.test('index basics', function(){

	var index = algebra.index(
		{sort: "name"},
		[{id: 1, name:"g"}, {id: 2, name:"j"}, {id: 3, name:"m"}, {id: 4, name:"s"}],
		{name: "k"});
	equal(index, 2);

    index = algebra.index(
		{sort: "-name"},
		[{id: 1, name:"g"}, {id: 2, name:"j"}, {id: 3, name:"m"}, {id: 4, name:"s"}].reverse(),
		{name: "k"});
	equal(index, 2);

    index = algebra.index(
		{},
		[{id: 1, name:"g"}, {id: 2, name:"j"}, {id: 3, name:"m"}, {id: 4, name:"s"}],
		{id: 0, name: "k"});

	equal(index, 0);


	index = algebra.index(
		{},
		[{id: 1, name:"g"}, {id: 2, name:"j"}, {id: 3, name:"m"}, {id: 4, name:"s"}],
		{name: "k"});

	equal(index, undefined, "no value if no id");

    var TODO_id = canReflect.assignSymbols({},{
        "can.schema": function(){
            return {
                kind: "record",
                identity: ["_id"],
                keys: {
                    id: Number,
                    points: Number,
                    complete: Boolean,
                    name: String
                }
            };
        }
    });
    var algebra2 = new QueryLogic(TODO_id);

    index = algebra2.index(
		{},
		[{id: 1, _id: 0}, {id: 2, _id: 1}, {id: 3, _id: 3}, {id: 4, _id: 4}],
		{id: 0, _id: 2});

	equal(index, 2);

	//var algebra = new set.Algebra(set.props.id("id"));

});

QUnit.test("filterMembers with reverse sort", function(){
    var sortedMembers = algebra.filterMembers(
		{sort: "-name"},
		[{id: 1, name:"a"}, {id: 2, name:"z"}, {id: 3, name:"f"}, {id: 4, name:"s"}]);

    QUnit.deepEqual(sortedMembers,
        [{id: 2, name:"z"}, {id: 4, name:"s"}, {id: 3, name:"f"}, {id: 1, name:"a"}]);
});
