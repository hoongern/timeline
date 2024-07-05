export function CSVToArray(csv: string, delimiter = ',') {
	delimiter = delimiter || ',';
	const objPattern = new RegExp(
		'(\\' +
			delimiter +
			'|\\r?\\n|\\r|^)' +
			'(?:"([^"]*(?:""[^"]*)*)"|' +
			'([^"\\' +
			delimiter +
			'\\r\\n]*))',
		'gi',
	);
	const data: string[][] = [[]];
	let matches: RegExpExecArray | null = null;

	while ((matches = objPattern.exec(csv))) {
		var matchedDelimiter = matches[1];
		if (matchedDelimiter.length && matchedDelimiter != delimiter) {
			data.push([]);
		}

		if (matches[2]) {
			var matchedValue = matches[2].replace(new RegExp('""', 'g'), '"');
		} else {
			var matchedValue = matches[3];
		}

		data[data.length - 1].push(matchedValue);
	}

	return data;
}
