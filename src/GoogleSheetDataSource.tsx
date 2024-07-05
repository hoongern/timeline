import React, { createContext, useContext, useEffect, useState } from 'react';
import { useCookies } from 'react-cookie';

export const sheetSourceCookie = 'sheet-source';

interface CookieContextValue {
	cookieValue: string | undefined;
}

interface DataSource {
	documentId: string;
	sheetNames: string[];
}

interface GoogleSheetData {
	[x: string]: string;
}

const CookieContext = createContext<CookieContextValue>({
	cookieValue: undefined,
});

export const useGoogleSheetData = (): [GoogleSheetData | undefined, () => void] => {
	const { cookieValue } = useContext(CookieContext);
	const source = cookieValue as any as DataSource;

	if (!source) {
		throw new Error('No Google Sheet data source');
	}

	const [isFetched, setIsFetched] = useState(false);

	const [sheetData, setSheetData] = useState<GoogleSheetData | undefined>(
		localStorage.getItem('sheetData')
			? JSON.parse(localStorage.getItem('sheetData') as string)
			: undefined,
	);

	const refresh = React.useCallback(() => {
		if (isFetched || sheetData) {
			return;
		}

		setIsFetched(true);

		const sheetUrls = source.sheetNames.map((sheetName) => {
			return `https://docs.google.com/spreadsheets/d/${source.documentId}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;
		});

		Promise.all(
			sheetUrls.map((url) =>
				fetch(url).then((response) => {
					if (!response.ok) {
						throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
					}
					return response.text();
				}),
			),
		).then((responses) => {
			const data = responses.reduce((acc, response, index) => {
				const sheetName = source.sheetNames[index];
				acc[sheetName] = response;
				return acc;
			}, {} as GoogleSheetData);

			localStorage.setItem('sheetData', JSON.stringify(data));
			setSheetData(data);
		});
	}, [source, isFetched, sheetData]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return [
		sheetData,
		() => {
			setIsFetched(false);
			setSheetData(undefined);
			localStorage.removeItem('sheetData');
			refresh();
		},
	];
};

const Setup: React.FC<{ onCookieSet: () => void }> = ({ onCookieSet }) => {
	const [documentIdValue, setDocumentIdValue] = useState('');
	const [sheetNamesValue, setSheetNamesValue] = useState('');
	const [cookies, setCookie] = useCookies([sheetSourceCookie]);

	const handleDocumentIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setDocumentIdValue(event.target.value);
	};

	const handleSheetNamesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setSheetNamesValue(event.target.value);
	};

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		setCookie(
			sheetSourceCookie,
			JSON.stringify({
				documentId: documentIdValue,
				sheetNames: sheetNamesValue.split(','),
			} as DataSource),
		);
		onCookieSet();
	};

	return (
		<div>
			<form onSubmit={handleSubmit}>
				<p>
					<label>
						Document ID:
						<input type="text" value={documentIdValue} onChange={handleDocumentIdChange} />
					</label>
				</p>
				<p>
					<label>
						Comma separated sheets:
						<input type="text" value={sheetNamesValue} onChange={handleSheetNamesChange} />
					</label>
				</p>
				<button type="submit">Submit</button>
			</form>
		</div>
	);
};

export const SetupGoogleSheet: React.FC<React.PropsWithChildren> = ({ children }) => {
	const [cookies] = useCookies([sheetSourceCookie]);

	return (
		<CookieContext.Provider value={{ cookieValue: cookies[sheetSourceCookie] }}>
			{!cookies[sheetSourceCookie] ? (
				<Setup
					onCookieSet={() => {
						window.location.reload();
					}}
				/>
			) : (
				children
			)}
		</CookieContext.Provider>
	);
};
