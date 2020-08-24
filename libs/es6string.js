//https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/startsWith

// startsWith, endsWith, and contains
"contains,startsWith,endsWith".split(",").forEach(
	function(a,n){if(!""[a]) String.prototype[a]=Function("s", "return this.indexOf(s)"+this[n])},
	"!==-1,===0,+s.length===this.length".split(",")
);


/*

// unit tests:
["hello world".endsWith("world"),
!"hello world".endsWith("hell"),
 "hello world".startsWith("hell"),
!"hello world".startsWith("world"),
 "hello world".contains("hell"),
!"hello world".contains("zebra")
].every(Boolean);

*/