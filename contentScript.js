console.log("contentScript.js ha sido cargado y está ejecutándose.");

document.addEventListener('click', function(e) {
    if (matchesMenuItem(e.target)) {
        setTimeout(handleModalInteractions, 300);
    }
});

document.addEventListener('click', function(e) {
    if (e.target.innerText === "OK") {
        setTimeout(handleModalInteractionsAfterIntro, 300);
    }
});

function handleModalInteractionsAfterIntro() {
    let dialog = document.querySelector('div[role="dialog"][data-state="open"]');
    if (dialog) {
        injectUI(dialog);
        bindSaveButtonEvent(dialog);
    }
}


function matchesMenuItem(target) {
    return target.matches('a[role="menuitem"][id^="headlessui-menu-item-"]') || 
           target.closest('a[role="menuitem"][id^="headlessui-menu-item-"]');
}

function handleModalInteractions() {
    console.log("Intentando detectar un modal abierto...");

    let dialog = document.querySelector('div[role="dialog"][data-state="open"]');
    if (!dialog) {
        return;
    }

    // Detectar la pantalla de introducción
    let introText = dialog.querySelector('h2[id^="radix-"]');
    if (introText && introText.textContent.includes("Introducing Custom Instructions")) {
        // Estamos en la pantalla de introducción, por lo que no inyectamos la UI ni hacemos ninguna otra operación.
        return;
    }

    injectUI(dialog);
    bindSaveButtonEvent(dialog);
}




function bindSaveButtonEvent(dialog) {
    let saveButton = dialog.querySelector('button.btn.btn-primary');
    if (!saveButton) return;

    saveButton.removeEventListener('click', saveProfileAction);
    saveButton.addEventListener('click', saveProfileAction);
}

function saveProfileAction(event) {
    let profileName;
    let profileInput = document.getElementById('profileNameInput');

    // Si existe el input, se toma el valor de ahí
    if (profileInput) {
        profileName = profileInput.value;
        if (!profileName || !profileName.trim()) {
            alert('Por favor, ingresa un nombre válido para el perfil.');
            event.stopPropagation();
            return;
        }
    } else {
        // Si no existe el input, se toma el nombre del perfil del dropdown
        let profileDropdown = document.getElementById('profileDropdown');
        if (!profileDropdown) {
            console.error('Error: No se encontró el dropdown "profileDropdown".');
            event.stopPropagation();
            return;
        }
        profileName = profileDropdown.value;
        if (!profileName) {
            console.error('Error: El dropdown no tiene un perfil seleccionado.');
            event.stopPropagation();
            return;
        }
    }

    // Obteniendo el elemento dialog
    let dialogElement = document.querySelector('div[role="dialog"][data-state="open"]');
    if (!dialogElement) {
        console.error('Error: No se encontró el elemento dialog.');
        event.stopPropagation();
        return;
    }
    saveProfileToLocalStorage(dialogElement);
}




function changeProfile(profileName) {
    // Si el perfilName es "add_new", simplemente regresamos sin hacer nada más.
    if (profileName === "add_new") {
        setTimeout(() => {
            let textareas = document.querySelectorAll('div[role="dialog"][data-state="open"] textarea:not(#prompt-textarea)');
            if (textareas.length === 0) {
                console.error('No se encontraron las textareas.');
                return;
            }
            textareas.forEach(textarea => {
                textarea.value = "";
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }, 300);  // Esperamos 300ms antes de ejecutar el código dentro de setTimeout
        return;
    }
    setProfileInstructions(profileName);
}


function handleDropdownChange(dialog) {
    console.log("Evento de cambio en el dropdown detectado."); // Nuevo log

    const selectedValue = document.getElementById("profileDropdown").value;
    const deleteButton = document.getElementById("deleteProfileButton");

    if (!deleteButton) {
        return;
    }

    if (selectedValue === "add_new") {
        let textareas = dialog.querySelectorAll('textarea:not(#prompt-textarea)');
        textareas.forEach(textarea => {
            textarea.value = "";
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
        });

        displayAddProfileFields(dialog);
        deleteButton.style.display = "none";
    } else if (selectedValue) {
        // Si se selecciona un perfil, mostramos el botón de eliminación
        deleteButton.style.display = "block";
        setProfileInstructions(selectedValue); // Asegúrate de que esta función solo maneje perfiles válidos.
    } else {
        // En caso contrario, ocultamos el botón
        deleteButton.style.display = "none";
    }
}


function setProfileInstructions(profileName) {
    let profiles = JSON.parse(localStorage.getItem('profiles')) || [];
    let selectedProfile = profiles.find(p => p.name === profileName);
    if (!selectedProfile) {
        return;
    }

    let textareas = document.querySelectorAll('div[role="dialog"][data-state="open"] textarea:not(#prompt-textarea)');
    if (textareas.length < 2) {
        return;
    }
    if (selectedProfile) {
        textareas[0].value = selectedProfile.instruction1 || "";
        textareas[0].dispatchEvent(new Event('input', { bubbles: true }));
        textareas[0].dispatchEvent(new Event('change', { bubbles: true }));
        
        if(textareas.length > 1) {
            textareas[1].value = selectedProfile.instruction2 || "";
            textareas[1].dispatchEvent(new Event('input', { bubbles: true }));
            textareas[1].dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            console.error('El elemento textarea[1] no está disponible.');
        }
    }
}

function triggerInputEvents(textareas) {
    textareas.forEach(textarea => {
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });
}


function injectUI(dialog) {
    if (isDropdownExist()) return;

    const profileDropdown = createProfileDropdown(dialog);
    const deleteButton = createDeleteButton();

    // Primero, insertamos profileDropdown y deleteButton.
    insertUIElements(dialog, profileDropdown, deleteButton); 

    console.log("Verificando estado del perfil..."); // Nuevo log

    if (isProfileUnsaved(dialog)) {
        console.log("Perfil no guardado detectado."); // Nuevo log
        suggestSaveProfile(dialog);
    } else {
        console.log("El perfil parece estar guardado."); // Nuevo log
    }

    // Paso 1: Identificar la primera visita
    let firstVisit = !localStorage.getItem('hasVisitedBefore');

    if (firstVisit) {
        // Paso 2: Verificar contenido de textareas utilizando la función waitForTextareas
        waitForTextareas(dialog, (textareas) => {
            if (textareas[0].value && textareas[1].value) {
                // Paso 3: Sugerir guardado de perfil

                // Utilizamos la función displayAddProfileFields con el argumento isSuggestion en true
                displayAddProfileFields(dialog, true);

                // Una vez sugerido, actualizamos la marca de visita
                localStorage.setItem('hasVisitedBefore', 'true');
            }
        });
    }
}




function isDropdownExist() {
    if (document.getElementById("profileDropdown")) {
        return true;
    }
    return false;
}

function createProfileDropdown(dialog) {
    let label = createLabel();
    let profileDropdown = createDropdown();

    profileDropdown.addEventListener('change', function() {
        handleDropdownChange(dialog, profileDropdown);  // Manejar el cambio en el dropdown
        changeProfile(profileDropdown.value);           // Cambiar el contenido de las textareas
    });

    return { label, dropdown: profileDropdown };
}


function createLabel() {
    let label = document.createElement('label');
    label.innerText = "Selecciona o crea un perfil:";
    label.htmlFor = "profileDropdown";
    return label;
}

function createDropdown() {
    let profileDropdown = document.createElement('select');
    profileDropdown.id = "profileDropdown";

    profileDropdown.appendChild(createEmptyOption());

    populateDropdownWithOptions(profileDropdown);

    profileDropdown.appendChild(createAddNewOption());

    const lastUsedProfile = localStorage.getItem('lastUsedProfile');

    if (lastUsedProfile) {
        profileDropdown.value = lastUsedProfile;
        // Invocamos a changeProfile con un pequeño retraso para asegurarnos de que las textareas están disponibles.
        setTimeout(() => {
            changeProfile(lastUsedProfile);
        }, 100); // un retraso de 100 ms
    }

    return profileDropdown;
}



function createEmptyOption() {
    let emptyOption = document.createElement('option');
    emptyOption.value = "";
    emptyOption.innerText = "-- Selecciona un perfil --";
    return emptyOption;
}

function createAddNewOption() {
    let addNewOption = document.createElement('option');
    addNewOption.value = "add_new";
    addNewOption.innerText = "Agregar nuevo perfil...";
    return addNewOption;
}

function populateDropdownWithOptions(profileDropdown) {
    let profiles = JSON.parse(localStorage.getItem('profiles')) || [];

    profiles.forEach(profile => {
        let option = document.createElement('option');
        option.value = profile.name;
        option.innerText = profile.name;
        profileDropdown.appendChild(option);
    });
}

function createDeleteButton() {
    let deleteButton = document.createElement('button');
    deleteButton.id = "deleteProfileButton";
    deleteButton.innerText = "Eliminar perfil actual";
    deleteButton.style.display = "none";

    deleteButton.addEventListener('click', function() {
        const selectedProfile = document.getElementById("profileDropdown").value;
        if (window.confirm('¿Estás seguro de que quieres eliminar el perfil seleccionado?')) {
            deleteProfileFromLocalStorage(selectedProfile);
            document.getElementById("profileDropdown").value = "";
        }
    });

    return deleteButton;
}

function deleteProfileFromLocalStorage(profileName) {
    let profiles = JSON.parse(localStorage.getItem('profiles')) || [];
    profiles = profiles.filter(p => p.name !== profileName);
    localStorage.setItem('profiles', JSON.stringify(profiles));

    // Limpiar las textareas y disparar eventos
    let textareas = document.querySelectorAll('textarea.w-full');
    textareas.forEach(textarea => {
        textarea.value = "";
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Luego, debemos actualizar el menú desplegable para reflejar la eliminación
    updateDropdownOptions();

     // Ocultar el botón de eliminar
     document.getElementById("deleteProfileButton").style.display = "none";
}

function insertUIElements(dialog, profileDropdown, deleteButton) {
    let insertPoint = dialog.querySelector('h2');
    if (insertPoint) {
        insertPoint.parentNode.insertBefore(profileDropdown.label, insertPoint.nextSibling);
        profileDropdown.label.parentNode.insertBefore(profileDropdown.dropdown, profileDropdown.label.nextSibling);
        profileDropdown.dropdown.parentNode.insertBefore(deleteButton, profileDropdown.dropdown.nextSibling);
    }
}

function createProfileNameInput() {
    let nameInput = document.createElement('input');
    nameInput.placeholder = "Nombre del perfil";
    nameInput.id = "profileNameInput";
    nameInput.style.border = "1px solid #ccc";
    return nameInput;
}

function createSaveProfileButton(dialog, nameInput) {
    let saveButton = document.createElement('button');
    saveButton.innerText = "Guardar Perfil";
    saveButton.style.border = "1px solid #ccc";
    saveButton.addEventListener('click', function() {
        let profileName = nameInput.value;
        if (profileName) {
            saveProfileToLocalStorage(dialog, profileName);
            postSaveActions(nameInput, saveButton);
        } else {
            alert('Por favor, proporcione un nombre para el perfil.');
        }
    });
    return saveButton;
}

function saveProfileToLocalStorage(dialog) {
    let profileName = document.getElementById('profileNameInput') ? document.getElementById('profileNameInput').value : null;
    if (!profileName) {
        let profileDropdown = document.getElementById('profileDropdown');
        if (profileDropdown) {
            profileName = profileDropdown.value;
        } else {
            console.error('No se pudo determinar el nombre del perfil.');
            return;
        }
    }
    
    if (!profileName || !profileName.trim()) {
        alert('Por favor, ingresa un nombre válido para el perfil.');
        return;
    }
    
    let textareas = dialog.querySelectorAll('textarea:not(#prompt-textarea)');
    if (textareas.length < 2) {
        return;
    }
    
    let profiles = JSON.parse(localStorage.getItem('profiles')) || [];
    let profile = profiles.find(p => p.name === profileName);
    
    if (profile) {
        profile.instruction1 = textareas[0].value;
        profile.instruction2 = textareas[1].value;
    } else {
        profile = {
            name: profileName,
            instruction1: textareas[0].value,
            instruction2: textareas[1].value
        };
        profiles.push(profile);
    }
    
    localStorage.setItem('profiles', JSON.stringify(profiles));
    localStorage.setItem('lastUsedProfile', profileName);


    if(document.getElementById('profileNameInput')) {
        document.getElementById('profileNameInput').style.display = 'none';
    }
}


function postSaveActions(nameInput, saveButton) {
    localStorage.setItem('hasVisitedBefore', 'true');
    nameInput.style.display = "none";
    saveButton.style.display = "none";
}

function clearTextareas(dialog) {
    let textareas = dialog.querySelectorAll('textarea.w-full');
    textareas.forEach(textarea => {
        textarea.value = "";
    });
}

function displayAddProfileFields(dialog, isSuggestion = false) {
    if (document.getElementById('profileNameInput')) {
        return;
    }
    
    let dropdown = dialog.querySelector('#profileDropdown');
    let nameInput = createProfileNameInput();
    dropdown.parentNode.insertBefore(nameInput, dropdown.nextSibling);
    
    if (isSuggestion) {
        let saveButton = createSaveProfileButton(dialog, nameInput);
        nameInput.parentNode.insertBefore(saveButton, nameInput.nextSibling);
    } else {
        clearTextareas(dialog);
    }
}


function waitForTextareas(dialog, callback, attempts = 0) {
    const MAX_ATTEMPTS = 10;
    const DELAY = 300;

    let textareas = dialog.querySelectorAll('textarea:not(#prompt-textarea)');

    if (textareas && textareas.length >= 2) {
        callback(textareas);
    } else if (attempts < MAX_ATTEMPTS) {
        setTimeout(() => {
            waitForTextareas(dialog, callback, attempts + 1);
        }, DELAY);
    } else {
        console.error('No se encontraron las textareas después de múltiples intentos.');
    }
}



function isProfileUnsaved(dialog) {
    if (!dialog) {
        console.error("Dialog no está definido.");
        return false; // o cualquier valor predeterminado que desees devolver en este caso
    }

    const selectedProfileValue = document.getElementById("profileDropdown").value;
    const textareas = dialog.querySelectorAll('textarea:not(#prompt-textarea)');

    if (textareas.length >= 2) {
        return !selectedProfileValue && (textareas[0].value || textareas[1].value);
    } else {
        //console.error("No se encontraron las textareas esperadas");
        return false; // o cualquier valor por defecto que quieras devolver en este caso
    }
}

function alignInputWithDropdown() {
    // Obtener la posición left del dropdown.
    let dropdownPosition = document.getElementById('profileDropdown').getBoundingClientRect().left;

    // Obtener la posición left del contenedor del diálogo.
    let dialogPosition = document.querySelector('[role="dialog"]').getBoundingClientRect().left;

    // Calcular el margen necesario para alinear el input con el dropdown.
    let requiredMargin = dropdownPosition - dialogPosition + "px";

    // Aplicar ese margen al input.
    document.getElementById('profileNameInput').style.marginLeft = requiredMargin;
}


function suggestSaveProfile(dialog) {
    console.log("Entrando a suggestSaveProfile");

    let suggestionBox = document.createElement('div');
    let input = createProfileNameInput();

    let saveButton = document.createElement('button');
    saveButton.innerText = "Guardar Perfil";
    
    console.log("Adjuntando listener al botón de guardar"); 

    saveButton.addEventListener('click', function() {
        console.log("Botón de guardar clickeado");
        saveProfileFromSuggestion(input, dialog);
    });

    suggestionBox.appendChild(input);
    suggestionBox.appendChild(saveButton);

    // Localizar el div con la clase 'p-4 sm:p-6 sm:pt-4', escapando los caracteres ':'.
    const targetDiv = dialog.querySelector('.p-4.sm\\:p-6.sm\\:pt-4');
    
    if (targetDiv) {
        dialog.insertBefore(suggestionBox, targetDiv);
    } else {
        // En caso de que no se encuentre el div, añadir al final del diálogo
        dialog.appendChild(suggestionBox);
    }
    alignInputWithDropdown();

    return suggestionBox; 
}






function updateAndRerenderDropdown(profileName) {
    let dropdown = document.getElementById("profileDropdown");
    let clonedDropdown = dropdown.cloneNode(true); // Clona el menú desplegable

    // Añade la nueva opción al clon
    let newOption = document.createElement('option');
    newOption.value = profileName;
    newOption.innerText = profileName;
    clonedDropdown.appendChild(newOption);

    // Selecciona el perfil recién creado en el clon
    clonedDropdown.value = profileName;

    // Reemplaza el menú desplegable original con el clon
    dropdown.parentNode.replaceChild(clonedDropdown, dropdown);
}

function updateDropdownWithNewProfile(profileName) {
    const dropdown = document.getElementById("profileDropdown");

    // Crear un nuevo elemento <option> para el dropdown
    const newOption = document.createElement('option');
    newOption.value = profileName;
    newOption.innerText = profileName;

    // Agregar el nuevo perfil al dropdown y seleccionarlo
    dropdown.appendChild(newOption);
    dropdown.value = profileName;
}


function saveProfileFromSuggestion(input, dialog) {
    console.log("Inicio de saveProfileFromSuggestion");

    const profileName = input.value;
    console.log("Nombre del perfil:", profileName);

    const textareas = dialog.querySelectorAll('textarea:not(#prompt-textarea)');
    console.log("Áreas de texto encontradas:", textareas.length);

    if (profileName) {
        console.log("Guardando perfil:", profileName);

        let profiles = JSON.parse(localStorage.getItem('profiles')) || [];
        profiles.push({
            name: profileName,
            instruction1: textareas[0].value,
            instruction2: textareas[1].value
        });
        localStorage.setItem('profiles', JSON.stringify(profiles));

        console.log("Perfil guardado en localStorage");

        // Lógica de actualización del dropdown
        updateDropdownWithNewProfile(profileName);

        console.log("Mostrando alerta...");
        alert('Perfil guardado con éxito.');

        // Ocultar el input y el botón después de guardar el perfil
        input.style.display = "none";
        const allButtons = dialog.querySelectorAll('button');
        allButtons.forEach(button => {
            if (button.innerText === "Guardar Perfil") {
                button.style.display = "none";
            }
        });

    } else {
        console.error('No se proporcionó un nombre para el perfil.');
    }
}




function updateDropdownOptions() {
    let dropdown = document.getElementById("profileDropdown");

    // Limpiar opciones actuales del dropdown
    while (dropdown.firstChild) {
        dropdown.removeChild(dropdown.firstChild);
    }
    
    // Usando las funciones existentes para poblar el dropdown
    dropdown.appendChild(createEmptyOption());
    populateDropdownWithOptions(dropdown);
    dropdown.appendChild(createAddNewOption());
    
    // Seleccionar el último perfil utilizado, si existe.
    const lastUsedProfile = localStorage.getItem('lastUsedProfile');
    if (lastUsedProfile) {
        dropdown.value = lastUsedProfile;
    }
}
