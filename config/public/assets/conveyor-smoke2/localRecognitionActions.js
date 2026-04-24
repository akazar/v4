export function onPerson(results, entry) {
    const persons = (results || []).filter((r) => r.categoryName === 'person' || r.name === 'person');
    console.log('[custom/onPerson]', persons.length, 'person(s)', { timeout: entry?.timeout });
}

export function onDog(results, entry) {
    const dogs = (results || []).filter((r) => r.categoryName === 'dog' || r.name === 'dog');
    console.log('[custom/onDog]', dogs.length, 'dog(s)', { timeout: entry?.timeout });
}