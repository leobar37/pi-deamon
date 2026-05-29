export function headersToRecord(headers) {
    const result = {};
    for (const [key, value] of headers) {
        result[key] = value;
    }
    return result;
}
//# sourceMappingURL=headers.js.map