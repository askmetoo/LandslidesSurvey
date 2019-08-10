"use strict";

/**
 * Collection of functions for the manipulation of the landslides.
 *
 * @namespace
 * @author Edoardo Pessina
 */
const landslide = {

    /** The icon of a landslide saved on the server. */
    _iconRemote: L.icon({
        iconUrl        : "img/ls-marker-remote.png",            // The url of the icon
        iconRetinaUrl  : "img/ls-marker-remote-2x.png",         // The url of the icon for retina displays
        shadowUrl      : "img/ls-marker-shadow.png",     // The url of the shadow
        shadowRetinaUrl: "img/ls-marker-shadow-2x.png",  // The url of the shadow for retina display
        iconSize       : [31, 37],                       // The size of the icon
        shadowSize     : [31, 19],                       // The size of the shadow
        iconAnchor     : [31, 37],                       // The position of the "tip" of the icon
        shadowAnchor   : [18, 18]                        // The position of the shadow anchor
    }),

    /** The icon of a landslide saved on the local database. */
    _iconLocal: L.icon({
        iconUrl        : "img/ls-marker-local.png",            // The url of the icon
        iconRetinaUrl  : "img/ls-marker-local-2x.png",         // The url of the icon for retina displays
        shadowUrl      : "img/ls-marker-shadow.png",     // The url of the shadow
        shadowRetinaUrl: "img/ls-marker-shadow-2x.png",  // The url of the shadow for retina display
        iconSize       : [31, 37],                       // The size of the icon
        shadowSize     : [31, 19],                       // The size of the shadow
        iconAnchor     : [31, 37],                       // The position of the "tip" of the icon
        shadowAnchor   : [18, 18]                        // The position of the shadow anchor
    }),


    /** The array containing all the markers currently on the map corresponding to the remote landslides. */
    remoteMarkers: [],

    /** The array containing all the markers currently on the map corresponding to the local landslides. */
    localMarkers: [],


    /**
     * Displays a landslide as a marker on the map.
     *
     * @param {string} id - The id of the landslide.
     * @param {number[]} coordinates - The coordinates of the landslide.
     * @param {boolean} isLocal - True if the the landslide is saved locally.
     */
    show: (id, coordinates, isLocal) => {

        // Create a new marker
        const marker = L.marker(coordinates, {
            icon     : landslide._iconRemote, // The icon of the marker
            draggable: false                  // The marker cannot be moved
        });

        // Set the id of the marker
        marker._id = id;

        // When the user clicks on the marker, open the landslide's info
        marker.on("click", () => InfoActivity.getInstance().open(id, isLocal));

        // Add the marker to the layer of the map
        MapActivity.getInstance().markersLayer.addLayer(marker);

        // If the landslide is local, change the marker icon and push it in the local markers array
        if (isLocal) {

            // Change the icon
            marker.setIcon(landslide._iconLocal);

            // Add the marker to the array
            landslide.localMarkers.push(marker);

        }

        // Else add the marker to the remote array
        else landslide.remoteMarkers.push(marker);

    },

    /** Retrieves and displays all the landslides of the currently logged user on the map. */
    showAll: () => {

        // Remove all the markers from the map
        // landslide.remoteMarkers.forEach(m => MapActivity.getInstance().markersLayer.removeLayer(m));
        MapActivity.getInstance().markersLayer.clearLayers();

        // Empty the markers arrays
        landslide.remoteMarkers = [];
        landslide.localMarkers  = [];


        // Retrieve the landslides in the local database
        const request = app.db.transaction("landslides", "readwrite").objectStore("landslides").getAll();

        // Fired if an error occurs
        request.onerror = err => {

            console.error("Error getting data", err);

            // Alert the user
            utils.createAlert("", i18next.t("dialogs.getLocalLsError"), i18next.t("dialogs.btnOk"));

        };

        // Fired if the request is successful
        request.onsuccess = e => {

            // Display the landslides
            e.target.result.forEach(ls => landslide.show(ls._id, ls.coordinates, true));

            // If there are some landslides in the local database, show the sync notification
            if (landslide.localMarkers.length !== 0) $("#sync-notification").show();

        };

        // If the app is offline, return
        if (!navigator.onLine) return;


        // Fetch from the server all the defibrillators of the logged user
        fetch(
            `${settings.serverUrl}/landslide/get-all`,
            { headers: { Authorization: `Bearer ${LoginActivity.getInstance().token}` } }
        )
            .then(res => {

                // If the server responds with something over than 200 (success), throw an error
                if (res.status !== 200) {
                    const err = new Error();
                    err.code  = res.status;
                    throw err;
                }

                // Parse the json response
                return res.json();

            })
            .then(data => {

                // Show each of the retrieved defibrillators
                data.landslides.forEach(d => landslide.show(d._id, d.coordinates, false));

            })
            .catch(err => {

                console.error(err);

                // Alert the user of the error

                // Unauthorized
                if (err.code === 401)
                    utils.createAlert(i18next.t("dialogs.title401"), i18next.t("dialogs.getLandslides401"), i18next.t("dialogs.btnOk"));

                // Generic server error
                else
                    utils.createAlert(i18next.t("dialogs.title500"), i18next.t("dialogs.getLandslides500"), i18next.t("dialogs.btnOk"));

            });

    },


    /**
     * Retrieves from the server the information about a landslide.
     *
     * @param {string} id - The id of the defibrillator.
     * @param {boolean} isLocal - True if the landslide is saved in the local database
     * @returns {Promise<object>} A promise containing the data about the landslide.
     */
    get: (id, isLocal) => {

        // Return a promise
        return new Promise((resolve, reject) => {

            // If the landslide is saved in the local database
            if (isLocal) {

                // Send a request to the local database
                const request = app.db
                    .transaction("landslides", "readwrite")
                    .objectStore("landslides")
                    .get(id);

                // Fired if an error occurs
                request.onerror = err => {

                    console.error("Retrieving ls failed", err);

                    // Close the loader
                    utils.closeLoader();

                    // Alert the user
                    utils.createAlert("", i18next.t("dialogs.info.getLocalLsError"), i18next.t("dialogs.btnOk"));

                    // Reject the promise
                    reject();

                };

                // Fired when the request is successful
                request.onsuccess = e => {

                    // Resolve the promise
                    resolve(e.target.result);

                }

            }

            // Else
            else {

                // Send a request to the server to retrieve the data
                fetch(
                    `${settings.serverUrl}/landslide/${id}`,
                    { headers: { Authorization: `Bearer ${LoginActivity.getInstance().token}` } }
                )
                    .then(res => {

                        // If the server responds with something over than 200 (success), throw an error
                        if (res.status !== 200) {
                            const err = new Error();
                            err.code  = res.status;
                            throw err;
                        }

                        // Parse the json response
                        return res.json();

                    })
                    .then(data => {

                        // Resolve the promise
                        resolve(data.landslide);

                    })
                    .catch(err => {

                        console.error(err);

                        // Close the loader
                        utils.closeLoader();

                        // Alert the user of the error
                        switch (err.code) {

                            // Unauthorized
                            case 401:
                                utils.createAlert(i18next.t("dialogs.title401"), i18next.t("dialogs.getLandslide401"), i18next.t("dialogs.btnOk"));
                                break;

                            // Not found
                            case 404:
                                utils.createAlert(i18next.t("dialogs.title404"), i18next.t("dialogs.getLandslide404"), i18next.t("dialogs.btnOk"));
                                break;

                            // Generic server error
                            default:
                                utils.createAlert(i18next.t("dialogs.title500"), i18next.t("dialogs.getLandslide500"), i18next.t("dialogs.btnOk"));
                                break;

                        }

                        // Reject the promise
                        reject();

                    });

            }

        });

    },


    /**
     * Sends a request to the server to insert a new landslide into the database.
     *
     * @param {FormData} formData - A FormData object containing the data about the landslide.
     * @returns {Promise<object>} A promise containing the id and the coordinates of the landslide.
     */
    post: formData => {

        // Return a new promise
        return new Promise((resolve, reject) => {

            // Send a request to the server to insert a new defibrillator
            fetch(
                `${settings.serverUrl}/landslide/post`,
                {
                    method : "POST",
                    headers: { Authorization: `Bearer ${LoginActivity.getInstance().token}` },
                    body   : formData
                }
            )
                .then(res => {

                    // If the server responds with something over than 201 (insert success), throw an error
                    if (res.status !== 201) {
                        const err = new Error();
                        err.code  = res.status;
                        throw err;
                    }

                    // Parse the json response
                    return res.json();

                })
                .then(data => {

                    // Resolve the promise
                    resolve({ id: data.landslide._id, coords: data.landslide.coordinates });

                })
                .catch(err => {

                    console.error(err);

                    // Close the loader
                    utils.closeLoader();

                    // Alert the user of the error
                    switch (err.code) {

                        // Unauthorized
                        case 401:
                            utils.createAlert(i18next.t("dialogs.title401"), i18next.t("dialogs.postLandslide401"), i18next.t("dialogs.btnOk"));
                            break;

                        // Wrong data
                        case 422:
                            utils.logOrToast(i18next.t("messages.postLandslide422"), "long");
                            break;

                        // Generic server error
                        default:
                            utils.createAlert(i18next.t("dialogs.title500"), i18next.t("dialogs.postLandslide500"), i18next.t("dialogs.btnOk"));
                            break;

                    }

                    // Reject the promise
                    reject();

                });

        });

    },

    postLocal: data => {

        return new Promise((resolve, reject) => {

            // ToDo delete
            if (!App.isCordova) {

                const request = app.db
                    .transaction("landslides", "readwrite")
                    .objectStore("landslides")
                    .add(data);

                request.onerror = err => {

                    console.log("An error occurred during the insert", err);

                    utils.closeLoader();

                    utils.createAlert("", i18next.t("dialogs.insert.insertError"), i18next.t("dialogs.btnOk"));

                    reject();

                };

                request.onsuccess = () => {

                    console.log("Insert done");

                    resolve({ id: data._id, coords: data.coordinates });

                };

                return;

            }

        });

    },


    /**
     * Sends a request to the server to update a landslide already present into the database.
     *
     * @param {string} id - The id of the landslide to update
     * @param {FormData} formData - A FormData object containing the data about the landslide.
     * @returns {Promise<object>} A promise containing the id of the landslide.
     */
    put: (id, formData) => {

        // Return a new promise
        return new Promise((resolve, reject) => {

            // Send a request to the server to insert a new landslide
            fetch(
                `${settings.serverUrl}/landslide/${id}`,
                {
                    method : "PUT",
                    headers: { Authorization: `Bearer ${LoginActivity.getInstance().token}` },
                    body   : formData
                }
            )
                .then(res => {

                    // If the server responds with something over than 200 (success), throw an error
                    if (res.status !== 200) {
                        const err = new Error();
                        err.code  = res.status;
                        throw err;
                    }

                    // Parse the json response
                    return res.json();

                })
                .then(data => {

                    // Resolve the promise
                    resolve({ id: data.landslide._id });

                })
                .catch(err => {

                    console.error(err);

                    // Close the loader
                    utils.closeLoader();

                    // Alert the user of the error
                    switch (err.code) {

                        // Unauthorized
                        case 401:
                            utils.createAlert(i18next.t("dialogs.title401"), i18next.t("dialogs.putLandslide401"), i18next.t("dialogs.btnOk"));
                            break;

                        // Not found
                        case 404:
                            utils.createAlert(i18next.t("dialogs.title404"), i18next.t("dialogs.putLandslide404"), i18next.t("dialogs.btnOk"));
                            break;

                        // Wrong data
                        case 422:
                            utils.logOrToast(i18next.t("messages.putLandslide422"), "long");
                            break;

                        // Generic server error
                        default:
                            utils.createAlert(i18next.t("dialogs.title500"), i18next.t("dialogs.putLandslide500"), i18next.t("dialogs.btnOk"));
                            break;

                    }

                    // Reject the promise
                    reject();

                });

        });

    },

    putLocal: (id, data) => {

        // Return a new promise
        return new Promise((resolve, reject) => {

            // Retrieve the landslide from the local database
            const getRequest = app.db
                .transaction("landslides", "readwrite")
                .objectStore("landslides")
                .get(id);

            // Fired if an error occurs
            getRequest.onerror = err => {

                console.error("Cannot get the landslide", err);

                // Close the loader
                utils.closeLoader();

                // Alert the user
                utils.createAlert("", i18next.t("dialogs.insert.putLocalError"), i18next.t("dialogs.btnOk"));

                // Reject the promise
                reject();

            };

            getRequest.onsuccess = e => {

                // Merge the result and the new data
                let ls = Object.assign(e.target.result, data);

                // Send a request to the local database
                const request = app.db
                    .transaction("landslides", "readwrite")
                    .objectStore("landslides")
                    .put(ls);

                // Fired if an error occurs
                request.onerror = err => {

                    console.log("An error occurred during the insert", err);

                    // Close the loader
                    utils.closeLoader();

                    // Alert the user
                    utils.createAlert("", i18next.t("dialogs.insert.putLocalError"), i18next.t("dialogs.btnOk"));

                    // Reject the promise
                    reject();

                };

                // Fired when the request is successful
                request.onsuccess = e => {

                    // Resolve the promise
                    resolve({ id: e.target.result._id });

                };

            };

        });

    },


    /**
     * Deletes a landslide from the database and removes it from the map.
     *
     * @param {string} id - The id of the landslide.
     * @param {boolean} isLocal - True if the landslide is saved in the local database.
     * @param {(string|null)} [localPhotoURL] - The local RL of the photo (has a value only if the landslide is local).
     * @returns {Promise<>} An empty promise.
     */
    delete: (id, isLocal, localPhotoURL = null) => {

        // Return a promise
        return new Promise((resolve, reject) => {

            // If the landslide is saved in the local database
            if (isLocal) {

                // Send a request to the local database
                const request = app.db
                    .transaction("landslides", "readwrite")
                    .objectStore("landslides")
                    .delete(id);

                // Fired if an error occurs
                request.onerror = err => {

                    console.error("Deleting failed", err);

                    // Close the loader
                    utils.closeLoader();

                    // Alert the user
                    utils.createAlert("", i18next.t("dialogs.deleteLocalLsError"), i18next.t("dialogs.btnOk"));

                    // Reject the promise
                    reject();

                };

                // Fired when the request is successful
                request.onsuccess = () => {

                    // ToDo photo

                    // Remove the marker
                    landslide.removeMarker(id, true);

                    // Resolve the promise
                    resolve();

                };

            }

            //Else
            else {

                // Send a request to the server to delete the landslide
                fetch(
                    `${settings.serverUrl}/landslide/${id}`,
                    {
                        method : "DELETE",
                        headers: { Authorization: `Bearer ${LoginActivity.getInstance().token}` }
                    }
                )
                    .then(res => {

                        // If the server responds with something over than 200 (success), throw an error
                        if (res.status !== 200) {
                            const err = new Error();
                            err.code  = res.status;
                            throw err;
                        }

                        // Remove the marker
                        landslide.removeMarker(id, false);

                        // Resolve the promise
                        resolve();

                    })
                    .catch(err => {

                        console.error(err);

                        // Close the loader
                        utils.closeLoader();

                        // Alert the user of the error
                        switch (err.code) {

                            // Unauthorized
                            case 401:
                                utils.createAlert(i18next.t("dialogs.title401"), i18next.t("dialogs.deleteLandslide401"), i18next.t("dialogs.btnOk"));
                                break;

                            // Not found
                            case 404:
                                utils.createAlert(i18next.t("dialogs.title404"), i18next.t("dialogs.deleteLandslide404"), i18next.t("dialogs.btnOk"));
                                break;

                            // Generic server error
                            default:
                                utils.createAlert(i18next.t("dialogs.title500"), i18next.t("dialogs.deleteLandslide500"), i18next.t("dialogs.btnOk"));
                                break;

                        }

                        // Reject the promise
                        reject();

                    });

            }

        });

    },

    /**
     * Removes from the map the marker of a landslide.
     *
     * @param {string} id - The id of the landslide.
     * @param {boolean} isLocal - True if the landslide is saved in the local database.
     */
    removeMarker: (id, isLocal) => {

        // Utility function to remove a marker
        const clear = array => {

            // Create a temporary array
            let newMarkers = [];

            // For each defibrillator
            array.forEach(m => {

                // If it's the one to delete, remove the correspondent marker from the map
                if (m._id === id) MapActivity.getInstance().markersLayer.removeLayer(m);

                // Else, push the marker in the temporary array
                else newMarkers.push(m)

            });

            // Save the temporary array as the new marker array
            array = newMarkers;

        };

        // If the landslide is local, user the local markers array
        if (isLocal) clear(landslide.localMarkers);

        // Else, use the remote markers array
        else clear(landslide.remoteMarkers);

    },

};